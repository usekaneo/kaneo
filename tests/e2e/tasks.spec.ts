import { randomUUID } from "node:crypto";
import {
  type APIRequestContext,
  expect,
  type Page,
  test,
  type WebSocket,
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
  await page.getByRole("link", { name: "All projects", exact: true }).click();
  await expect(page).toHaveURL(/\/projects$/);
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
  // The modal's title field also matches the text until the dialog closes.
  await expect(
    page.getByPlaceholder("Task title", { exact: true }),
  ).toBeHidden();
  await expect(page.getByText(title, { exact: true })).toBeVisible();
}

async function editTask(page: Page, title: string, updated: string) {
  await page.getByText(title, { exact: true }).click();
  const input = page.getByPlaceholder("Click to add a title", { exact: true });
  // Task data and edit permissions load independently when the detail panel opens.
  await expect(input).toHaveValue(title);
  await expect(input).toBeEditable();
  const [saved] = await Promise.all([
    page.waitForResponse(
      (response) =>
        response.url().includes("/api/task/title/") &&
        response.request().method() === "PUT" &&
        response.request().postDataJSON().title === updated,
    ),
    input.fill(updated),
  ]);
  expect(saved.ok()).toBe(true);
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
  test.setTimeout(120_000);
  const workspaceId = await createWorkspace(page);
  const boardUrl = await createProject(page);
  await createTask(page, "Collaborative task");

  const colleague = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: test.info().project.use.ignoreHTTPSErrors,
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
    let connectedSocket: WebSocket | undefined;
    const socketErrors: string[] = [];
    observer.on("console", (message) => {
      if (message.type() === "error") socketErrors.push(message.text());
    });
    observer.on("websocket", (socket) => {
      if (new URL(socket.url()).pathname !== `/api/ws/${projectId}`) return;
      socket.on("socketerror", (error) => socketErrors.push(String(error)));
      socket.on("framesent", ({ payload }) => {
        if (String(payload) === '{"type":"ping"}') connectedSocket = socket;
      });
      socket.on("close", () => {
        if (connectedSocket === socket) connectedSocket = undefined;
      });
    });
    await observer.goto(boardUrl);
    await expect(
      observer.getByText("Collaborative task", { exact: true }),
    ).toBeVisible();

    // Playwright's websocket event fires before the handshake succeeds. The app's
    // native keepalive proves it is open and also tolerates its normal reconnects.
    await expect
      .poll(() => Boolean(connectedSocket), {
        timeout: 45_000,
        message: "The project websocket must send its keepalive before editing",
      })
      .toBe(true)
      .catch(async (error) => {
        await test.info().attach("websocket-errors", {
          body: JSON.stringify(socketErrors),
          contentType: "application/json",
        });
        throw error;
      });
    if (!connectedSocket) throw new Error("Project websocket disconnected");

    // Observe the real event as well as the UI, so a refetch cannot hide a broken websocket.
    const update = connectedSocket.waitForEvent(
      "framereceived",
      ({ payload }) => {
        const message = JSON.parse(String(payload));
        return (
          message.type === "TASK_UPDATED" && message.projectId === projectId
        );
      },
    );
    await Promise.all([
      update,
      editTask(page, "Collaborative task", "Updated by my teammate"),
    ]);
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

test("task timer persists across reloads and stops from task details", async ({
  page,
}) => {
  await createWorkspace(page);
  await createProject(page);
  await createTask(page, "Track release work");
  await page.getByText("Track release work", { exact: true }).click();
  const start = page.getByRole("button", { name: "Start timer", exact: true });
  const stop = page.getByRole("button", { name: "Stop timer", exact: true });
  const history = page.getByRole("button", {
    name: "Time tracking",
    exact: true,
  });
  await expect(start).toBeEnabled();
  await history.click();
  await expect(
    page.getByText("No time logged yet.", { exact: true }),
  ).toBeVisible();

  const [created] = await Promise.all([
    page.waitForResponse(
      (response) =>
        /^\/api\/time-entry\/?$/.test(new URL(response.url()).pathname) &&
        response.request().method() === "POST",
    ),
    start.click(),
  ]);
  expect(created.ok()).toBe(true);
  const entry = await created.json();
  expect(entry.endTime).toBeNull();
  await expect(stop).toBeEnabled();
  await expect(page.getByText(/^Running \d+s$/)).toBeVisible();

  await page.reload();
  await expect(stop).toBeEnabled();
  await history.click();
  await expect(page.getByText(/^Running \d+s$/)).toBeVisible();
  await page.screenshot({ path: test.info().outputPath("timer-running.png") });
  const [updated] = await Promise.all([
    page.waitForResponse(
      (response) =>
        new URL(response.url()).pathname === `/api/time-entry/${entry.id}` &&
        response.request().method() === "PUT",
    ),
    stop.click(),
  ]);
  expect(updated.ok()).toBe(true);
  const stopped = await updated.json();
  expect(stopped.endTime).not.toBeNull();
  expect(stopped.duration).toBeGreaterThanOrEqual(0);
  await expect(start).toBeEnabled();
  await expect(stop).toHaveCount(0);

  await page.reload();
  await expect(start).toBeEnabled();
  await history.click();
  await expect(
    page.getByText("Task Tester", { exact: true }).last(),
  ).toBeVisible();
  await expect(page.getByText(/^Running /)).toHaveCount(0);
  const response = await page.request.get(
    `/api/time-entry/task/${entry.taskId}`,
  );
  await expect(response).toBeOK();
  const entries = await response.json();
  expect(entries).toHaveLength(1);
  expect(entries[0]).toMatchObject({
    id: entry.id,
    endTime: stopped.endTime,
    duration: stopped.duration,
  });
  await page.screenshot({ path: test.info().outputPath("timer-stopped.png") });
});
