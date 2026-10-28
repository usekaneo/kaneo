import assert from "node:assert/strict";
import { copyFile, mkdir, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { chromium } from "playwright";
import { WORKSPACE_CAPABILITY_NAMES } from "../../packages/permissions/src/capabilities.ts";
import { fixture, installFixtures } from "./fixtures.mjs";
import {
  board,
  columns,
  comments,
  date,
  homepageTask,
  relatedTask,
  relations,
  labels,
  members,
  project,
  projectId,
  tasks,
  workspace,
  workspaceId,
} from "./product-fixtures.mjs";
import { api, fulfillJSON, origin, root, startWebApp } from "./web-app.mjs";

const output = `${root}apps/site/public/images/product`;
const docsOutput = `${root}apps/docs/images/product`;
const projectPath = `/dashboard/workspace/${workspaceId}/project/${projectId}`;
const views = [
  ["board", `${projectPath}/board`, "board", "Redirect the old pricing links"],
  ["list", `${projectPath}/board`, "list", "Redirect the old pricing links"],
  ["timeline", `${projectPath}/gantt`, "board", "Five customer interviews"],
  [
    "task",
    `${projectPath}/task/${homepageTask.id}`,
    "board",
    "Check the mobile spacing",
  ],
];

function respond(url, method) {
  const p = new URL(url).pathname.replace(/\/$/, "");
  const taskMatch = p.match(/^\/api\/task\/(product-task-\d+)$/);
  if (taskMatch) {
    const task = tasks.find((item) => item.id === taskMatch[1]);
    return task && { ...task, workspaceId };
  }
  if (p === "/api/project") return [project];
  if (p === `/api/project/${projectId}`) return project;
  if (p === `/api/task/tasks/${projectId}`)
    return {
      data: board,
      pagination: {
        total: tasks.length,
        page: 1,
        pageSize: 100,
        totalPages: 1,
        relatedPage: 1,
        relatedPageSize: 100,
        relatedTotalPages: 1,
      },
    };
  if (p === `/api/column/${projectId}`) return columns;
  if (p === `/api/workspace/${workspaceId}/capabilities`)
    return Object.fromEntries(
      WORKSPACE_CAPABILITY_NAMES.map((name) => [name, true]),
    );
  if (p === `/api/workspace/${workspaceId}/members`)
    return members.map(({ user, role }) => ({
      id: user.id,
      name: user.name,
      email: user.email,
      image: null,
      role,
    }));
  if (p === "/api/task/assigned") {
    const assigned = tasks
      .filter((task) => task.userId === members[0].userId)
      .filter((task) => task.status !== "done")
      .map((task) => ({
        id: task.id,
        projectId,
        number: task.number,
        title: task.title,
        status: task.status,
        statusName: columns.find((c) => c.slug === task.status).name,
        statusIcon: null,
        priority: task.priority,
        dueDate: task.dueDate,
        projectName: project.name,
        projectSlug: project.slug,
        projectIcon: project.icon,
        labels: task.labels,
      }));
    return { tasks: assigned, total: assigned.length };
  }
  if (p === `/api/activity/${homepageTask.id}`) return comments;
  if (p === `/api/label/task/${homepageTask.id}`) return homepageTask.labels;
  if (p === `/api/external-link/task/${homepageTask.id}`)
    return homepageTask.externalLinks;
  if (p === `/api/task-relation/project/${projectId}`) return relations;
  if (p.startsWith("/api/task-relation/product-task-")) {
    const taskId = p.split("/").pop();
    return relations
      .filter((r) => r.sourceTaskId === taskId || r.targetTaskId === taskId)
      .map((r) => ({
        ...r,
        sourceTask: relatedTask(tasks.find((t) => t.id === r.sourceTaskId)),
        targetTask: relatedTask(tasks.find((t) => t.id === r.targetTaskId)),
      }));
  }
  if (p === `/api/gitlab-integration/project/${projectId}`) return null;
  if (p === `/api/label/workspace/${workspaceId}`) return Object.values(labels);
  if (
    p === `/api/custom-field/project/${projectId}/values` ||
    p === `/api/custom-field/project/${projectId}/filter-values` ||
    /^\/api\/(external-link\/task|custom-field\/task)\/product-task-\d+$/.test(
      p,
    )
  )
    return [];
  if (p.endsWith("/organization/list-members"))
    return { members, total: members.length };
  if (p.endsWith("/organization/get-full-organization"))
    return { ...fixture(url, method), ...workspace, members };
  if (p.endsWith("/organization/list")) return [workspace];
  return undefined;
}

async function showTimelineFrom(page, dayLabel) {
  await page.evaluate((dayLabel) => {
    const container = document.querySelector(
      '[data-testid="gantt-scroll-container"]',
    );
    const leaves = [...container.querySelectorAll("*")].filter(
      (el) => el.children.length === 0,
    );
    const day = leaves.find((el) => el.textContent.trim() === dayLabel);
    const rail = leaves
      .find((el) => el.textContent.trim().toLowerCase() === "task")
      .closest("*:is(div, th)");
    let sticky = rail;
    while (sticky && getComputedStyle(sticky).position !== "sticky")
      sticky = sticky.parentElement;
    const column = day.closest("*:is(div, th)");
    container.scrollLeft +=
      column.getBoundingClientRect().left -
      (sticky ?? rail).getBoundingClientRect().right;
  }, dayLabel);
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => resolve())),
  );
}

await mkdir(output, { recursive: true });
const server = await startWebApp();
let browser;
try {
  browser = await chromium.launch();
  for (const theme of ["light", "dark"]) {
    for (const [view, path, viewMode, readyText] of views) {
      if (
        process.env.PRODUCT_SCREENSHOT_VIEW &&
        process.env.PRODUCT_SCREENSHOT_VIEW !== view
      )
        continue;
      const context = await browser.newContext({
        viewport: { width: 1728, height: 1000 },
        deviceScaleFactor: 2,
        locale: "en-US",
        timezoneId: "UTC",
        colorScheme: theme,
        reducedMotion: "reduce",
        serviceWorkers: "block",
      });
      const diagnostics = { unhandled: [], blocked: [] };
      await installFixtures(context, origin, diagnostics);
      await context.addInitScript(
        ([theme, viewMode]) => {
          localStorage.setItem(
            "user-preferences",
            JSON.stringify({
              state: { theme, viewMode, weekStartsOn: 1 },
              version: 0,
            }),
          );
        },
        [theme, viewMode],
      );
      await context.route(`${api}/**`, async (route) => {
        const request = route.request();
        const data =
          request.method() === "GET"
            ? respond(request.url(), request.method())
            : undefined;
        if (data === undefined) return route.fallback();
        await fulfillJSON(route, data);
      });
      const page = await context.newPage();
      const errors = [];
      const consoleErrors = [];
      page.on("pageerror", (e) => errors.push(e.message));
      page.on("requestfailed", (r) =>
        consoleErrors.push(`${r.url()} ${r.failure()?.errorText}`),
      );
      page.on("framenavigated", (f) => consoleErrors.push(`frame ${f.url()}`));
      await page.clock.setFixedTime(new Date(date));
      await page.goto(`${origin}${path}`);
      await page
        .getByText(readyText, { exact: true })
        .first()
        .waitFor()
        .catch(async (error) => {
          const failure = `${tmpdir()}/product-${view}-${theme}-failure.png`;
          await page.screenshot({ path: failure });
          console.error(
            JSON.stringify({
              view,
              theme,
              failure,
              errors,
              consoleErrors,
              ...diagnostics,
            }),
          );
          throw error;
        });
      await page.waitForLoadState("networkidle");
      await page.evaluate(() => document.fonts.ready);
      if (view === "timeline") await showTimelineFrom(page, "6");
      await page.mouse.move(0, 0);
      await page.screenshot({
        path: `${output}/${view}-${theme}.png`,
        animations: "disabled",
      });
      console.log(JSON.stringify({ view, theme, errors, ...diagnostics }));
      assert.deepEqual(errors, []);
      assert.deepEqual(diagnostics.unhandled, []);
      await context.close();
      const docsFile = `${docsOutput}/${view}-${theme}.png`;
      if (await stat(docsFile).catch(() => null))
        await copyFile(`${output}/${view}-${theme}.png`, docsFile);
      if (view === "board")
        await copyFile(
          `${output}/${view}-${theme}.png`,
          `${root}apps/site/public/images/${theme}.png`,
        );
    }
  }
} finally {
  await browser?.close();
  server.kill("SIGTERM");
}
