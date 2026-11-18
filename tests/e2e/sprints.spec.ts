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
  const email = `sprint-${suffix}@example.com`;
  await post(request, "auth/sign-up/email", {
    name: "Sprint Tester",
    email,
    password: `Browser-test-${suffix}`,
  });
  return email;
}

async function createWorkspace(page: Page) {
  await signUp(page.request);
  const workspace = await post(page.request, "auth/organization/create", {
    name: "Sprint test workspace",
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

test("plan, run, and close a sprint around one backlog task", async ({
  page,
}) => {
  await createWorkspace(page);
  const boardUrl = await createProject(page);
  await page.goto(boardUrl.replace("/board", "/backlog"));

  // Seed one task through the real creation modal; it lands in the backlog.
  await page.getByTitle("Add task", { exact: true }).first().click();
  await page
    .getByPlaceholder("Task title", { exact: true })
    .fill("Sprint planning chore");
  await page.getByRole("button", { name: "Create Task", exact: true }).click();
  await expect(
    page.getByText("Sprint planning chore", { exact: true }),
  ).toBeVisible();

  // Plan the first sprint. An empty name generates the next free "Sprint N".
  await page
    .getByRole("button", { name: "Create sprint", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Create sprint", exact: true })
    .last()
    .click();
  await expect(page.getByText("Sprint 1", { exact: true })).toBeVisible();

  // Assign the task to the sprint from the task sheet's sprint control.
  await page
    .getByText("Sprint planning chore", { exact: true })
    .first()
    .click();
  const sprintTrigger = page.getByRole("button", {
    name: "Backlog",
    exact: true,
  });
  await expect(sprintTrigger).toBeVisible();
  await sprintTrigger.click();
  await page
    .getByRole("button", { name: "Sprint 1", exact: true })
    .last()
    .click();
  await expect(sprintTrigger).toContainText("Sprint 1");
  await page.getByRole("button", { name: "Close", exact: true }).click();

  // Start the sprint; it becomes the project's single active sprint.
  await page.getByRole("button", { name: "Start sprint", exact: true }).click();
  await expect(page.getByText("Active", { exact: true })).toBeVisible();

  // Close the sprint. With no future sprint the unfinished task returns to
  // the backlog, and the sprint stays visible as closed history.
  await page.getByRole("button", { name: "Close sprint", exact: true }).click();
  await page
    .getByRole("button", {
      name: "Close sprint and move unfinished tasks",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("Closed sprints (1)", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Sprint planning chore", { exact: true }),
  ).toBeVisible();
});
