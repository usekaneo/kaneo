import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("sign up, create a workspace, and sign in again", async ({
  page,
  context,
}) => {
  const suffix = randomUUID();
  const email = `browser-${suffix}@example.com`;
  const password = `Browser-test-${suffix}`;
  const workspaceName = `Browser test ${suffix.slice(0, 8)}`;

  await page.goto("/auth/sign-up");
  await page.getByLabel("Full Name", { exact: true }).fill("Browser Tester");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Create Account", exact: true })
    .click();

  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByLabel("Workspace name", { exact: true }).fill(workspaceName);
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await expect(page).toHaveURL(/\/dashboard\/workspace\/[^/]+\/?$/);
  const workspaceUrl = page.url();

  // A reload proves that the server persisted the workspace and session.
  await page.reload();
  await expect(page).toHaveURL(workspaceUrl);
  await expect(
    page.getByText(workspaceName, { exact: true }).first(),
  ).toBeVisible();

  await context.clearCookies();
  await page.goto(workspaceUrl);
  await expect(page).toHaveURL(/\/auth\/sign-in/);
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign In", exact: true }).click();
  await expect(page).toHaveURL(workspaceUrl);
  await expect(
    page.getByText(workspaceName, { exact: true }).first(),
  ).toBeVisible();
});
