import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as events from "../../apps/api/src/events";
import createGiteaIntegration from "../../apps/api/src/gitea-integration/controllers/create-gitea-integration";
import createGitlabIntegration from "../../apps/api/src/gitlab-integration/controllers/create-gitlab-integration";
import { getSyncIntegration } from "../../apps/api/src/integration-sync/controllers/get-integration";
import { previewSyncRules } from "../../apps/api/src/integration-sync/controllers/preview-rules";
import { saveSyncRules } from "../../apps/api/src/integration-sync/controllers/save-rules";
import {
  defaultSyncRules,
  type SyncRules,
} from "../../apps/api/src/plugins/sync/rules";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const verify = vi.hoisted(() => vi.fn());
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  GiteaApiError: class extends Error {},
  verifyGiteaToken: verify,
  createGiteaClient: () => ({ getRepo: async () => ({}) }),
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  GitlabApiError: class extends Error {},
  verifyGitlabToken: verify,
  createGitlabClient: () => ({ getProject: async () => ({}) }),
}));
beforeEach(async () => {
  await resetTestDatabase();
  verify.mockReset().mockResolvedValue({ id: 1 });
  vi.spyOn(events, "publishEvent").mockResolvedValue(undefined);
});

it.each(["gitea", "gitlab"] as const)(
  "%s reconnect cannot overwrite rules saved during verification",
  async (type) => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const base = {
      baseUrl: "https://git.example",
      accessToken: "test-only",
      webhookSecret: "test-hook",
    };
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type,
        isActive: true,
        config: JSON.stringify({
          ...base,
          repositoryOwner: "team",
          repositoryName: "repo",
          projectPath: "team/repo",
          syncRules: defaultSyncRules,
        }),
      })
      .returning();
    const reconnect = () =>
      type === "gitea"
        ? createGiteaIntegration({
            ...base,
            projectId: project.id,
            repositoryOwner: "team",
            repositoryName: "repo",
          })
        : createGitlabIntegration({
            ...base,
            projectId: project.id,
            tokenType: "private",
            projectPath: "team/repo",
          });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    verify.mockImplementationOnce(async () => {
      await gate;
      return { id: 1 };
    });
    const pending = reconnect();
    const conflict = expect(pending).rejects.toMatchObject({ status: 409 });
    const rules: SyncRules = {
      ...defaultSyncRules,
      incoming: { mode: "labels", match: "all", labels: ["ready"] },
    };
    try {
      await vi.waitFor(() => expect(verify).toHaveBeenCalledOnce());
      const preview = await previewSyncRules(
        await getSyncIntegration(project.id, type),
        rules,
      );
      await saveSyncRules(
        project.id,
        type,
        rules,
        preview.previewToken,
        workspace.id,
      );
    } finally {
      release();
      await conflict;
    }
    expect(
      JSON.parse(
        (await db.query.integrationTable.findFirst({
          where: eq(schema.integrationTable.id, integration!.id),
        }))!.config,
      ).syncRules,
    ).toEqual(rules);
    await reconnect();
    expect(
      JSON.parse(
        (await db.query.integrationTable.findFirst({
          where: eq(schema.integrationTable.id, integration!.id),
        }))!.config,
      ).syncRules,
    ).toEqual(rules);
  },
);
