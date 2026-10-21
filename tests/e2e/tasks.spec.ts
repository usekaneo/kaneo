import { post, signUp, createWorkspace } from "./helpers/workspace";
import { randomUUID } from "node:crypto";
import { expect, type Page, test, type WebSocket } from "@playwright/test";

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

test("search for people, select multiple assignees, and remove just one", async ({
  page,
  browser,
}) => {
  const workspaceId = await createWorkspace(page);
  const boardUrl = await createProject(page);
  const projectId = new URL(boardUrl).pathname
    .split("/project/")[1]
    .split("/")[0];
  const baseURL = test.info().project.use.baseURL;
  const colleague = await browser.newContext({
    baseURL,
    ignoreHTTPSErrors: test.info().project.use.ignoreHTTPSErrors,
    locale: "en-US",
  });
  try {
    const email = await signUp(colleague.request, "Pair Programmer");
    const invitation = await post(
      page.request,
      "auth/organization/invite-member",
      { organizationId: workspaceId, email, role: "member" },
    );
    await post(colleague.request, "auth/organization/accept-invitation", {
      invitationId: invitation.id,
    });
    const me = await (await page.request.get("/api/auth/get-session")).json();
    const teammate = await (
      await colleague.request.get("/api/auth/get-session")
    ).json();
    // Reload to exercise the same persisted member data as a fresh browser session.
    await page.goto(boardUrl);
    await page.getByTitle("Add task", { exact: true }).first().click();
    const title = `Pair work ${randomUUID()}`;
    await page.getByPlaceholder("Task title", { exact: true }).fill(title);
    await page.getByRole("button", { name: "Assign", exact: true }).click();
    const search = page.getByRole("combobox", {
      name: "Assignee",
      exact: true,
    });
    await search.fill(email);
    await page
      .getByRole("option", { name: "Pair Programmer", exact: true })
      .click();
    await search.fill(me.user.email);
    await page
      .getByRole("option", { name: "Task Tester", exact: true })
      .click();
    await expect(
      page.getByRole("option", { name: "Task Tester", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await search.press("Escape");
    const [created] = await Promise.all([
      page.waitForResponse(
        (response) =>
          response.request().method() === "POST" &&
          new URL(response.url()).pathname === `/api/task/${projectId}`,
      ),
      page.getByRole("button", { name: "Create Task", exact: true }).click(),
    ]);
    expect(created.ok()).toBe(true);
    const task = await created.json();
    const readPeople = async () => {
      const response = await page.request.get(`/api/task/${task.id}`);
      await expect(response).toBeOK();
      return (await response.json()).assignees
        .map((person: { id: string }) => person.id)
        .sort();
    };
    expect(await readPeople()).toEqual([me.user.id, teammate.user.id].sort());
    await page.getByText(title, { exact: true }).click();
    await page.locator('[data-task-action="assignee"]:visible').first().click();
    await search.fill(email);
    await page
      .getByRole("option", { name: "Pair Programmer", exact: true })
      .click();
    await expect(
      page.getByRole("option", { name: "Pair Programmer", exact: true }),
    ).toHaveAttribute("aria-selected", "false");
    expect(await readPeople()).toEqual([me.user.id]);
    await page.goto(boardUrl);
    await page
      .locator(`[data-task-id="${task.id}"]`)
      .first()
      .click({ button: "right" });
    await page.getByRole("menuitem", { name: "Assignee", exact: true }).click();
    const dialog = page.getByRole("dialog", { name: "Assignee", exact: true });
    await dialog
      .getByRole("combobox", { name: "Assignee", exact: true })
      .fill(email);
    await dialog
      .getByRole("option", { name: "Pair Programmer", exact: true })
      .click();
    await expect(
      dialog.getByRole("option", { name: "Pair Programmer", exact: true }),
    ).toHaveAttribute("aria-selected", "true");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("combobox").press("Escape");
    await page.reload();
    expect(await readPeople()).toEqual([me.user.id, teammate.user.id].sort());
    const colleaguePage = await colleague.newPage();
    await colleaguePage.goto(`/dashboard/workspace/${workspaceId}/my-tasks`);
    await expect(colleaguePage.getByText(title, { exact: true })).toBeVisible();
  } finally {
    await colleague.close();
  }
});
