import { expect, test } from "@playwright/test";
import { post, createWorkspace } from "./helpers/workspace";

test("personal views persist across browsers and support rename replace and delete", async ({
  page,
  browser,
}) => {
  const workspaceId = await createWorkspace(page);
  const project = await post(page.request, "project", {
    name: "Saved views project",
    workspaceId,
    slug: "SV",
    icon: "Folder",
  });
  for (const title of ["Bug for saved view", "Unrelated work"])
    await post(page.request, `task/${project.id}`, {
      title,
      description: "",
      priority: "high",
      status: "to-do",
    });
  const boardUrl = `/dashboard/workspace/${workspaceId}/project/${project.id}/board`;
  await page.goto(boardUrl);
  await expect(page.getByText("Unrelated work", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Search tasks", exact: true }).click();
  await page
    .getByRole("searchbox", { name: "Search tasks", exact: true })
    .fill("Bug");
  await expect(page.getByText("Unrelated work", { exact: true })).toBeHidden();
  await page.getByRole("button", { name: "Display", exact: true }).click();
  await page.getByRole("button", { name: "List", exact: true }).click();
  await page.getByRole("combobox", { name: "Sort by", exact: true }).click();
  await page.getByRole("option", { name: "Title", exact: true }).click();
  await page.getByRole("button", { name: "Display", exact: true }).click();
  await page
    .getByRole("button", { name: "Personal views", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Save current view", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("View name", { exact: true }).fill("My bugs");
  await dialog.getByLabel("View name", { exact: true }).press("Enter");
  await expect(dialog).toBeHidden();
  const fresh = await browser.newContext();
  try {
    await fresh.addCookies(await page.context().cookies());
    const other = await fresh.newPage();
    await other.goto(boardUrl);
    await expect(
      other.getByText("Unrelated work", { exact: true }),
    ).toBeVisible();
    await other
      .getByRole("button", { name: "Personal views", exact: true })
      .click();
    await other.getByRole("button", { name: "My bugs", exact: true }).click();
    await expect(
      other.getByRole("searchbox", { name: "Search tasks", exact: true }),
    ).toHaveValue("Bug");
    await expect(
      other.getByText("Unrelated work", { exact: true }),
    ).toBeHidden();
    await other.getByRole("button", { name: "Display", exact: true }).click();
    await expect(
      other.getByRole("button", { name: "List", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await expect(
      other.getByRole("combobox", { name: "Sort by", exact: true }),
    ).toHaveText("Title");
    await other.getByRole("button", { name: "Display", exact: true }).click();
    await other
      .getByRole("button", { name: "Personal views", exact: true })
      .click();
    await other
      .getByRole("button", { name: "Edit My bugs", exact: true })
      .click();
    const edit = other.getByRole("dialog");
    await edit.getByLabel("View name", { exact: true }).fill("Renamed bugs");
    await edit.getByLabel("View name", { exact: true }).press("Enter");
    await expect(edit).toBeHidden();
    await other
      .getByRole("searchbox", { name: "Search tasks", exact: true })
      .fill("Unrelated");
    await other
      .getByRole("button", { name: "Personal views", exact: true })
      .click();
    await other
      .getByRole("button", { name: "Edit Renamed bugs", exact: true })
      .click();
    await edit
      .getByRole("button", { name: "Replace with current view", exact: true })
      .click();
    await expect(edit).toBeHidden();
    await other
      .getByRole("searchbox", { name: "Search tasks", exact: true })
      .fill("Bug");
    await other
      .getByRole("button", { name: "Personal views", exact: true })
      .click();
    await other
      .getByRole("button", { name: "Renamed bugs", exact: true })
      .click();
    await expect(
      other.getByRole("searchbox", { name: "Search tasks", exact: true }),
    ).toHaveValue("Unrelated");
    await expect(
      other.getByText("Bug for saved view", { exact: true }),
    ).toBeHidden();
    await other
      .getByRole("button", { name: "Personal views", exact: true })
      .click();
    await expect(
      other.getByText("Only you can see these views.", { exact: true }),
    ).toBeVisible();
    await expect(other.locator('[data-slot="popover-popup"]')).toHaveCSS(
      "opacity",
      "1",
    );
    await other.screenshot({
      path: ".cache/personal-views-desktop.png",
      fullPage: true,
    });
    await other
      .getByRole("button", { name: "Edit Renamed bugs", exact: true })
      .click();
    await edit.getByRole("button", { name: "Delete", exact: true }).click();
    await edit
      .getByRole("button", { name: "Confirm delete", exact: true })
      .click();
    await expect(edit).toBeHidden();
    await other
      .getByRole("button", { name: "Personal views", exact: true })
      .click();
    await expect(
      other.getByText("No saved views yet.", { exact: true }),
    ).toBeVisible();
    await other.reload();
    await expect(
      other.getByText("Unrelated work", { exact: true }),
    ).toBeVisible();
  } finally {
    await fresh.close();
  }
});
