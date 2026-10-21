import { expect, test } from "@playwright/test";
import { post, createWorkspace } from "./helpers/workspace";

test("workspace overview filters across projects and opens tasks from the board", async ({
  page,
}) => {
  const workspaceId = await createWorkspace(page);
  const session = await (
    await page.request.get("/api/auth/get-session")
  ).json();
  const first = await post(page.request, "project", {
    name: "Overview first project",
    workspaceId,
    slug: "OV1",
    icon: "Folder",
  });
  const second = await post(page.request, "project", {
    name: "Overview second project",
    workspaceId,
    slug: "OV2",
    icon: "Folder",
  });
  const owned = await post(page.request, `task/${first.id}`, {
    title: "Overview owned task",
    description: "",
    priority: "high",
    status: "to-do",
    userId: session.user.id,
  });
  await post(page.request, `task/${second.id}`, {
    title: "Overview completed task",
    description: "",
    priority: "low",
    status: "done",
  });
  await page.goto(`/dashboard/workspace/${workspaceId}/tasks`);
  await expect(
    page.getByText("Overview owned task", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Overview completed task", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Assignee", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Assignee", exact: true })
    .fill(session.user.email);
  await page.getByRole("option", { name: "Task Tester", exact: true }).click();
  await expect(
    page.getByText("Overview owned task", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Overview completed task", { exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Clear all", exact: true }).click();
  await expect(
    page.getByText("Overview completed task", { exact: true }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Project", exact: true }).click();
  await page
    .getByRole("option", { name: "Overview first project", exact: true })
    .click();
  await expect(
    page.getByText("Overview completed task", { exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: "Board", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Open", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Completed", exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".cache/workspace-views-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByText("Overview owned task", { exact: true }),
  ).toBeVisible();
  await page.screenshot({
    path: ".cache/workspace-views-mobile.png",
    fullPage: true,
  });
  await page.getByText("Overview owned task", { exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/task/${owned.id}$`));
  await expect(
    page.getByPlaceholder("Click to add a title", { exact: true }),
  ).toHaveValue("Overview owned task");
});
