import { randomUUID } from "node:crypto";
import {
  type APIRequestContext,
  type Page,
  expect,
  test,
} from "@playwright/test";

export async function post(
  request: APIRequestContext,
  path: string,
  data: object,
) {
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

export async function signUp(request: APIRequestContext, name = "Task Tester") {
  const suffix = randomUUID();
  const email = `task-${suffix}@example.com`;
  await post(request, "auth/sign-up/email", {
    name,
    email,
    password: `Browser-test-${suffix}`,
  });
  return email;
}

export async function createWorkspace(page: Page) {
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
