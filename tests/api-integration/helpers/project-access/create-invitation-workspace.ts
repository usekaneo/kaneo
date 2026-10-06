import { createApp } from "../../../../apps/api/src/index";
import { expect } from "vite-plus/test";
import { signUpWithSession } from "../auth-session";
import { createProjectFixture } from "../fixtures";
import { projectAccessApi } from "./project-access-api";

export async function createInvitationWorkspace() {
  const { app } = createApp();
  const owner = await signUpWithSession(app, {
    email: "owner@example.com",
    name: "Owner",
  });
  const ownerRequest = projectAccessApi({ cookie: owner.cookies });
  const created = await ownerRequest("/auth/organization/create", {
    method: "POST",
    body: { name: "Agency", slug: "agency" },
  });
  expect(created.status).toBe(200);
  const workspace = (await created.json()) as { id: string };
  const alpha = await createProjectFixture({
    workspaceId: workspace.id,
    name: "Alpha",
    slug: "alpha",
  });
  const beta = await createProjectFixture({
    workspaceId: workspace.id,
    name: "Beta",
    slug: "beta",
  });
  return {
    app,
    ownerRequest,
    workspaceId: workspace.id,
    alpha: alpha.project,
    beta: beta.project,
  };
}
