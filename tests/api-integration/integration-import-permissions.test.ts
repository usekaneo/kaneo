import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const provider = vi.hoisted(() => ({
  listIssues: vi.fn(async () => []),
  listPulls: vi.fn(async () => []),
}));
vi.mock(
  "../../apps/api/src/plugins/gitea/utils/gitea-api",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/gitea/utils/gitea-api")
    >()),
    createGiteaClient: () => provider,
  }),
);
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});
describe("github and gitea import permissions", () => {
  it.each(["github", "gitea"])(
    "%s denies a create-only custom role",
    async (type) => {
      const member = await createWorkspaceMember({ role: "importer" });
      await db.insert(schema.workspaceRoleTable).values({
        workspaceId: member.workspace.id,
        role: "importer",
        permission: JSON.stringify({ task: ["create"] }),
      });
      const { project } = await createProjectFixture({
        workspaceId: member.workspace.id,
      });
      mockAuthenticatedSession(member.user);
      const { app } = createApp();
      const response = await app.request(
        `/api/${type}-integration/import-issues`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ projectId: project.id }),
        },
      );
      expect(response.status).toBe(403);
      expect(provider.listIssues).not.toHaveBeenCalled();
    },
  );
  it("gitea accepts a custom role with both create and update", async () => {
    const member = await createWorkspaceMember({ role: "importer" });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: member.workspace.id,
      role: "importer",
      permission: JSON.stringify({ task: ["create", "update"] }),
    });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    await db.insert(schema.integrationTable).values({
      projectId: project.id,
      type: "gitea",
      config: JSON.stringify({
        baseUrl: "https://gitea.example",
        accessToken: "fake-test-token",
        repositoryOwner: "owner",
        repositoryName: "repo",
      }),
    });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const response = await app.request("/api/gitea-integration/import-issues", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectId: project.id }),
    });
    expect(response.status).toBe(200);
    expect(provider.listIssues).toHaveBeenCalled();
  });
});
