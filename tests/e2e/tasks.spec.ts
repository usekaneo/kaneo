import { randomUUID } from "node:crypto";
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
} from "@playwright/test";

async function post(request: APIRequestContext, path: string, data: object) {
  const baseURL = test.info().project.use.baseURL;
  if (!baseURL) throw new Error("Browser tests require a baseURL");
  const response = await request.post(`/api/${path}`, {
    data,
    // Authenticated fixture requests must satisfy the same origin checks as the UI.
    headers: { Origin: new URL(baseURL).origin },
  });
  await expect(response).toBeOK();
  return response.json();
}

async function signUp(request: APIRequestContext) {
  const suffix = randomUUID();
  const email = `task-${suffix}@example.com`;
  await post(request, "auth/sign-up/email", {
    name: "Task Tester",
    email,
    password: `Browser-test-${suffix}`,
  });
  return email;
}

async function createWorkspace(page: Page) {
  await signUp(page.request);
  const workspace = await post(page.request, "auth/organization/create", {
    name: "Task test workspace",
    slug: `browser-${randomUUID()}`,
  });
  await post(page.request, "auth/organization/set-active", {
    organizationId: workspace.id,
  });
  await page.goto(`/dashboard/workspace/${workspace.id}`);
  return workspace.id as string;
}

async function createProject(page: Page) {
  await page
    .getByRole("button", { name: "Create project", exact: true })
    .first()
    .click();
  await page
    .getByPlaceholder("Project name", { exact: true })
    .fill("Browser project");
  await page
    .getByRole("button", { name: "Create Project", exact: true })
    .click();
  await expect(page).toHaveURL(/\/project\/[^/]+\/board$/);
  await expect(
    page.getByTitle("Add task", { exact: true }).first(),
  ).toBeVisible();
  return page.url();
}

async function createTask(page: Page, title: string) {
  await page.getByTitle("Add task", { exact: true }).first().click();
  await page.getByPlaceholder("Task title", { exact: true }).fill(title);
  await page.getByRole("button", { name: "Create Task", exact: true }).click();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

async function editTask(page: Page, title: string, updated: string) {
  await page.getByText(title, { exact: true }).click();
  const saved = page.waitForResponse(
    (response) =>
      response.url().includes("/api/task/title/") &&
      response.request().method() === "PUT",
  );
  await page
    .getByPlaceholder("Click to add a title", { exact: true })
    .fill(updated);
  expect((await saved).ok()).toBe(true);
}

test("create a project and task, then persist a task edit", async ({
  page,
}) => {
  await createWorkspace(page);
  const boardUrl = await createProject(page);
  await createTask(page, "Plan the release");
  await editTask(page, "Plan the release", "Release plan approved");
  await page.reload();
  await expect(
    page.getByPlaceholder("Click to add a title", { exact: true }),
  ).toHaveValue("Release plan approved");
  await page.goto(boardUrl);
  await expect(
    page.getByText("Release plan approved", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("Plan the release", { exact: true })).toHaveCount(
    0,
  );
});

test("another workspace member receives task edits in realtime", async ({
  page,
  browser,
  baseURL,
}) => {
  const workspaceId = await createWorkspace(page);
  const boardUrl = await createProject(page);
  await createTask(page, "Collaborative task");

  const colleague = await browser.newContext({
    baseURL,
    locale: "en-US",
    viewport: { width: 1440, height: 1000 },
  });
  try {
    const email = await signUp(colleague.request);
    const invitation = await post(
      page.request,
      "auth/organization/invite-member",
      {
        organizationId: workspaceId,
        email,
        role: "member",
      },
    );
    await post(colleague.request, "auth/organization/accept-invitation", {
      invitationId: invitation.id,
    });
    await post(colleague.request, "auth/organization/set-active", {
      organizationId: workspaceId,
    });
    const observer = await colleague.newPage();
    const projectId = new URL(boardUrl).pathname
      .split("/project/")[1]
      .split("/")[0];
    const socketOpened = observer.waitForEvent(
      "websocket",
      (socket) => new URL(socket.url()).pathname === `/api/ws/${projectId}`,
    );
    await observer.goto(boardUrl);
    const socket = await socketOpened;
    await expect(
      observer.getByText("Collaborative task", { exact: true }),
    ).toBeVisible();

    // Observe the real event as well as the UI, so a refetch cannot hide a broken websocket.
    const update = socket.waitForEvent("framereceived", ({ payload }) => {
      const message = JSON.parse(String(payload));
      return message.type === "TASK_UPDATED" && message.projectId === projectId;
    });
    await editTask(page, "Collaborative task", "Updated by my teammate");
    await update;
    // Keep this page open: no reload, navigation, or focus change to trigger a refetch.
    await expect(
      observer.getByText("Updated by my teammate", { exact: true }),
    ).toBeVisible();
    await expect(
      observer.getByText("Collaborative task", { exact: true }),
    ).toHaveCount(0);
  } finally {
    await colleague.close();
  }
});
