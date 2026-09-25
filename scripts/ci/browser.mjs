import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { createRequire } from "node:module";
import { Client, localOrigin, password, ready } from "./http.mjs";

const require = createRequire(
  new URL("../ui-review-bot/package.json", import.meta.url),
);
const { chromium } = require("playwright");
const origin = localOrigin(process.argv[2]);
await ready(origin);
const owner = new Client(origin);
await owner.signup("browser-owner");
const workspace = await owner.json("/api/auth/organization/create", "POST", {
  name: "Browser regression",
  slug: `browser-${Date.now()}`,
});
const outsider = new Client(origin);
await outsider.signup("browser-outsider");
const browser = await chromium.launch();
const context = await browser.newContext({
  locale: "en-US",
  viewport: { width: 1440, height: 1000 },
});
context.setDefaultTimeout(20_000);
await context.tracing.start({
  screenshots: true,
  snapshots: true,
  sources: true,
});
const failures = [];
context.on("page", (page) => {
  page.on("pageerror", (error) => failures.push(error.message));
});
const page = await context.newPage();
try {
  await page.goto(`${origin}/auth/sign-in`);
  await page.getByLabel("Email", { exact: true }).fill(owner.email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: /^Sign In$/i }).click();
  await page.waitForURL("**/dashboard/**");
  await page.goto(`${origin}/dashboard/workspace/${workspace.id}`);
  await page.getByRole("button", { name: "Add project", exact: true }).click();
  const projectDialog = page.getByRole("dialog", {
    name: "Create a new project",
  });
  await projectDialog
    .getByPlaceholder("Project name", { exact: true })
    .fill("Browser regression project");
  const [projectResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === "/api/project" &&
        response.request().method() === "POST",
    ),
    projectDialog
      .getByRole("button", { name: "Create Project", exact: true })
      .click(),
  ]);
  assert.ok(projectResponse.ok(), await projectResponse.text());
  const project = await projectResponse.json();
  await page.goto(
    `${origin}/dashboard/workspace/${workspace.id}/project/${project.id}/board`,
  );
  await page.getByTitle("Add task", { exact: true }).first().click();
  const taskDialog = page.getByRole("dialog");
  await taskDialog
    .getByPlaceholder("Task title", { exact: true })
    .fill("Browser persistence task");
  const [taskResponse] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/task/${project.id}` &&
        response.request().method() === "POST",
    ),
    taskDialog
      .getByRole("button", { name: "Create Task", exact: true })
      .click(),
  ]);
  assert.ok(taskResponse.ok(), await taskResponse.text());
  const task = await taskResponse.json();
  await page.goto(
    `${origin}/dashboard/workspace/${workspace.id}/project/${project.id}/task/${task.id}`,
  );
  const observer = await context.newPage();
  // Observe connection readiness without replacing the transport or mocking messages.
  await observer.addInitScript(() => {
    const opened = new Set();
    window.__ciOpenSockets = opened;
    window.WebSocket = new Proxy(window.WebSocket, {
      construct(Target, args) {
        const socket = new Target(...args);
        socket.addEventListener("open", () => opened.add(socket.url));
        socket.addEventListener("close", () => opened.delete(socket.url));
        return socket;
      },
    });
  });
  await observer.goto(page.url());
  await observer.waitForFunction(
    (projectId) =>
      [...window.__ciOpenSockets].some(
        (url) => new URL(url).pathname === `/api/ws/${projectId}`,
      ),
    project.id,
  );
  await observer.getByRole("button", { name: "To Do", exact: true }).waitFor();
  await page.bringToFront();
  await page.getByRole("button", { name: "To Do", exact: true }).click();
  const [changedStatus] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/task/status/${task.id}` &&
        response.request().method() === "PUT",
    ),
    page.getByRole("button", { name: /^In Progress/ }).click(),
  ]);
  assert.ok(changedStatus.ok());
  // The other tab must update through WebSocket-driven query invalidation, without a reload.
  await observer
    .getByRole("button", { name: "In Progress", exact: true })
    .waitFor();
  await observer.close();
  await page.reload();
  await page
    .getByRole("button", { name: "In Progress", exact: true })
    .waitFor();
  const persisted = await owner.json(`/api/task/${task.id}`);
  assert.equal(persisted.title, "Browser persistence task");
  assert.equal(persisted.status, "in-progress");
  for (const [path, options] of [
    [`/api/project/${project.id}`, {}],
    [`/api/task/${task.id}`, {}],
    [
      `/api/task/status/${task.id}`,
      { method: "PUT", body: { status: "done" } },
    ],
  ]) {
    const response = await outsider.response(path, options);
    assert.ok(
      [403, 404].includes(response.status),
      `Outsider accessed ${path}: ${response.status}`,
    );
  }
  assert.equal(
    (await owner.json(`/api/task/${task.id}`)).status,
    "in-progress",
  );
  assert.deepEqual(failures, [], "Browser runtime errors");
  console.log(
    "Browser sign-in, project/task creation, status persistence and workspace isolation passed",
  );
} catch (error) {
  await mkdir(".cache/ci-results", { recursive: true });
  await page
    .screenshot({ path: ".cache/ci-results/browser.png", fullPage: true })
    .catch(() => {});
  await context.tracing.stop({ path: ".cache/ci-results/browser-trace.zip" });
  throw error;
} finally {
  await context.close();
  await browser.close();
}
