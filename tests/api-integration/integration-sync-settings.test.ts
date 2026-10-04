import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as events from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { getSyncIntegration } from "../../apps/api/src/integration-sync/controllers/get-integration";
import { previewSyncRules } from "../../apps/api/src/integration-sync/controllers/preview-rules";
import { saveSyncRules } from "../../apps/api/src/integration-sync/controllers/save-rules";
import * as giteaConfig from "../../apps/api/src/plugins/gitea/config";
import * as gitlabConfig from "../../apps/api/src/plugins/gitlab/config";
import {
  defaultSyncRules,
  type SyncRules,
} from "../../apps/api/src/plugins/sync/rules";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
  vi.spyOn(events, "publishEvent").mockResolvedValue(undefined);
});

it.each(["gitea", "gitlab"] as const)(
  "%s settings cannot overwrite rules saved during validation",
  async (type) => {
    const member = await createWorkspaceMember({ role: "owner" });
    const { project } = await createProjectFixture({
      workspaceId: member.workspace.id,
    });
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type,
        isActive: true,
        config: JSON.stringify({
          baseUrl: "https://git.example",
          accessToken: "test-only",
          repositoryOwner: "team",
          repositoryName: "repo",
          projectPath: "team/repo",
          syncRules: defaultSyncRules,
        }),
      })
      .returning();
    mockAuthenticatedSession(member.user);
    const { app } = createApp();
    const property =
      type === "gitea"
        ? "commentTaskLinkOnGiteaIssue"
        : "commentTaskLinkOnGitlabIssue";
    const patch = () =>
      app.request(`/api/${type}-integration/project/${project.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [property]: false }),
      });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const validation =
      type === "gitea"
        ? vi.spyOn(giteaConfig, "validateGiteaConfig")
        : vi.spyOn(gitlabConfig, "validateGitlabConfig");
    validation.mockImplementationOnce(async () => {
      await gate;
      return { valid: true };
    });
    const pending = patch();
    const rules: SyncRules = {
      ...defaultSyncRules,
      incoming: { mode: "labels", match: "all", labels: ["ready"] },
    };
    try {
      await vi.waitFor(() => expect(validation).toHaveBeenCalledOnce());
      const preview = await previewSyncRules(
        await getSyncIntegration(project.id, type),
        rules,
      );
      await saveSyncRules(
        project.id,
        type,
        rules,
        preview.previewToken,
        member.workspace.id,
      );
    } finally {
      release();
    }
    expect((await pending).status).toBe(409);
    const readConfig = async () =>
      JSON.parse(
        (await db.query.integrationTable.findFirst({
          where: eq(schema.integrationTable.id, integration!.id),
        }))!.config,
      );
    expect((await readConfig()).syncRules).toEqual(rules);
    expect((await patch()).status).toBe(200);
    expect(await readConfig()).toMatchObject({
      syncRules: rules,
      [property]: false,
    });
  },
);
