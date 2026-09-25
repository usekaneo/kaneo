import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import createIntegration from "../../apps/api/src/github-integration/controllers/create-github-integration";
import deleteIntegration from "../../apps/api/src/github-integration/controllers/delete-github-integration";
import { initialImportState } from "../../apps/api/src/github-integration/import-state";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const { verify } = vi.hoisted(() => ({ verify: vi.fn() }));
vi.mock(
  "../../apps/api/src/github-integration/controllers/verify-repository-owner",
  () => ({ verifyRepositoryOwner: verify }),
);
beforeEach(async () => {
  await resetTestDatabase();
  verify.mockReset();
});
async function setup() {
  const member = await createWorkspaceMember({ role: "admin" });
  const { project } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const config = {
    repositoryOwner: "owner",
    repositoryName: "repo",
    installationId: 1,
    repositoryId: 2,
    verifiedGithubAccountId: "3",
    verifiedByUserId: member.user.id,
    branchPattern: "feature/{slug}-{number}",
    commentTaskLinkOnGitHubIssue: false,
  };
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "github",
      isActive: true,
      config: JSON.stringify(config),
    })
    .returning();
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Existing task", number: 1 })
    .returning();
  const [link] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://github.com/owner/repo/issues/1",
    })
    .returning();
  await db
    .insert(schema.githubImportTable)
    .values({ integrationId: integration.id, state: initialImportState(2) });
  verify.mockResolvedValue({
    repositoryOwner: "owner",
    repositoryName: "repo",
    repositoryId: 2,
    installationId: 1,
    verifiedGithubAccountId: "3",
    verifiedByUserId: member.user.id,
  });
  const connect = () =>
    createIntegration({
      userId: member.user.id,
      projectId: project.id,
      repositoryOwner: "owner",
      repositoryName: "repo",
    });
  mockAuthenticatedSession(member.user);
  const { app } = createApp();
  return { project, config, integration, task, link, connect, app };
}

describe("GitHub repository changes preserve link ownership", () => {
  it("rejects a different numeric repository even when its name is identical", async () => {
    const { integration, config, link, connect } = await setup();
    verify.mockResolvedValue({ ...config, repositoryId: 99 });
    await expect(connect()).rejects.toMatchObject({ status: 409 });
    expect(await db.query.integrationTable.findFirst()).toMatchObject({
      id: integration.id,
      config: integration.config,
    });
    expect(await db.query.externalLinkTable.findFirst()).toMatchObject(link);
    expect(await db.query.githubImportTable.findFirst()).toBeDefined();
  });
  it("preserves links, pending imports and settings when the same repository is renamed or reinstalled", async () => {
    const { config, integration, link, connect } = await setup();
    verify.mockResolvedValue({
      repositoryOwner: "new-owner",
      repositoryName: "renamed",
      repositoryId: 2,
      installationId: 88,
      verifiedGithubAccountId: "3",
      verifiedByUserId: config.verifiedByUserId,
    });
    expect(await connect()).toMatchObject({
      id: integration.id,
      repositoryName: "renamed",
      installationId: 88,
    });
    expect(
      JSON.parse((await db.query.integrationTable.findFirst())?.config ?? "{}"),
    ).toMatchObject({
      branchPattern: config.branchPattern,
      commentTaskLinkOnGitHubIssue: false,
      repositoryId: 2,
    });
    expect(await db.query.externalLinkTable.findFirst()).toMatchObject(link);
    expect(await db.query.githubImportTable.findFirst()).toBeDefined();
  });
  it("allows administrator reverification of a matching legacy name, but requires disconnect for a different name", async () => {
    const { config, integration, connect } = await setup();
    const legacy = {
      repositoryOwner: "OWNER",
      repositoryName: "REPO",
      installationId: 1,
    };
    await db
      .update(schema.integrationTable)
      .set({ config: JSON.stringify(legacy) })
      .where(eq(schema.integrationTable.id, integration.id));
    verify.mockResolvedValue({ ...config, repositoryName: "another" });
    await expect(connect()).rejects.toMatchObject({ status: 409 });
    verify.mockResolvedValue(config);
    await expect(connect()).resolves.toMatchObject({ id: integration.id });
  });
  it("requires an explicit disconnect when an existing configuration cannot establish repository identity", async () => {
    const { integration, connect } = await setup();
    await db
      .update(schema.integrationTable)
      .set({ config: "invalid" })
      .where(eq(schema.integrationTable.id, integration.id));
    await expect(connect()).rejects.toMatchObject({ status: 409 });
    expect(await db.query.externalLinkTable.findFirst()).toBeDefined();
  });
  it("permits switching after disconnect without reusing old links or import cursors", async () => {
    const { project, config, integration, task, connect } = await setup();
    await deleteIntegration(project.id);
    verify.mockResolvedValue({
      ...config,
      repositoryId: 99,
      repositoryName: "other",
    });
    const next = await connect();
    expect(next.id).not.toBe(integration.id);
    expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
    expect(await db.query.githubImportTable.findMany()).toHaveLength(0);
    expect(await db.query.taskTable.findFirst()).toMatchObject({ id: task.id });
  });
  it.each(["reconnect", "settings"])(
    "rejects a concurrent repository change during %s instead of overwriting the new binding",
    async (operation) => {
      const { project, config, integration, connect, app } = await setup();
      const nextConfig = JSON.stringify({
        ...config,
        repositoryId: 99,
        repositoryName: "new",
      });
      const find = db.query.integrationTable.findFirst.bind(
        db.query.integrationTable,
      );
      const spy = vi
        .spyOn(db.query.integrationTable, "findFirst")
        .mockImplementationOnce(async (...args) => {
          const row = await find(...args);
          await db
            .update(schema.integrationTable)
            .set({ config: nextConfig })
            .where(eq(schema.integrationTable.id, integration.id));
          return row;
        });
      try {
        if (operation === "reconnect")
          await expect(connect()).rejects.toMatchObject({ status: 409 });
        else {
          const response = await app.request(
            `/api/github-integration/project/${project.id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ commentTaskLinkOnGitHubIssue: true }),
            },
          );
          expect(response.status).toBe(409);
        }
      } finally {
        spy.mockRestore();
      }
      expect((await db.query.integrationTable.findFirst())?.config).toBe(
        nextConfig,
      );
    },
  );
});
