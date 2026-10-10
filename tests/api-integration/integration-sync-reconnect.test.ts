import { createHmac } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as events from "../../apps/api/src/events";
import createGiteaIntegration from "../../apps/api/src/gitea-integration/controllers/create-gitea-integration";
import createGitlabIntegration from "../../apps/api/src/gitlab-integration/controllers/create-gitlab-integration";
import { getSyncIntegration } from "../../apps/api/src/integration-sync/controllers/get-integration";
import { previewSyncRules } from "../../apps/api/src/integration-sync/controllers/preview-rules";
import { saveSyncRules } from "../../apps/api/src/integration-sync/controllers/save-rules";
import { handleGiteaWebhookRequest } from "../../apps/api/src/plugins/gitea/webhook-handler";
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
vi.mock(
  "../../apps/api/src/plugins/gitea/utils/gitea-api",
  async (original) => ({
    ...(await original<object>()),
    GiteaApiError: class extends Error {},
    verifyGiteaToken: verify,
    createGiteaClient: () => ({ getRepo: async () => ({}) }),
  }),
);
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

it("preserves signed incoming webhooks when reconnecting with invalid saved rules", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const webhookSecret = " test-only-existing-secret ";
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type: "gitea",
      isActive: true,
      config: JSON.stringify({
        baseUrl: "https://git.example",
        accessToken: "old-test-token",
        repositoryOwner: "team",
        repositoryName: "repo",
        webhookSecret,
        issueSyncMode: "ingest-only",
        syncRules: { incoming: { mode: "invalid" } },
        branchPattern: "invalid-config-must-not-carry-forward",
        commentTaskLinkOnGiteaIssue: false,
      }),
    })
    .returning();

  const reconnected = await createGiteaIntegration({
    projectId: project.id,
    baseUrl: "https://git.example",
    accessToken: "new-test-token",
    repositoryOwner: "team",
    repositoryName: "repo",
  });
  expect(reconnected.webhookSecret).toBe(webhookSecret);
  expect(reconnected.issueSyncMode).toBe("ingest-only");
  expect(verify).toHaveBeenCalledWith("https://git.example", "new-test-token");
  const saved = await db.query.integrationTable.findFirst({
    where: eq(schema.integrationTable.id, integration!.id),
  });
  expect(JSON.parse(saved!.config)).toMatchObject({
    accessToken: "new-test-token",
    webhookSecret,
    issueSyncMode: "ingest-only",
    branchPattern: "{slug}-{number}",
    commentTaskLinkOnGiteaIssue: true,
  });
  expect(JSON.parse(saved!.config).syncRules).toBeUndefined();

  const body = JSON.stringify({
    action: "created",
    repository: {
      owner: { login: "team" },
      name: "repo",
      html_url: "https://git.example/team/repo",
    },
    issue: {
      number: 42,
      title: "Signed issue after reconnect",
      body: "Still authenticated with the existing secret",
      html_url: "https://git.example/team/repo/issues/42",
      state: "open",
      labels: [],
      user: { login: "author" },
    },
  });
  const signature = createHmac("sha256", webhookSecret)
    .update(body)
    .digest("hex");
  expect(
    await handleGiteaWebhookRequest(integration!.id, body, signature, "issues"),
  ).toEqual({ success: true });
  const tasks = await db.query.taskTable.findMany({
    where: eq(schema.taskTable.projectId, project.id),
  });
  expect(tasks).toMatchObject([
    {
      title: "Signed issue after reconnect",
      description: "Still authenticated with the existing secret",
    },
  ]);
  expect(
    await db.query.externalLinkTable.findMany({
      where: eq(schema.externalLinkTable.integrationId, integration!.id),
    }),
  ).toMatchObject([
    { taskId: tasks[0]!.id, externalId: "42", resourceType: "issue" },
  ]);
  const invalidSignature = createHmac("sha256", "different-test-secret")
    .update(body)
    .digest("hex");
  expect(
    await handleGiteaWebhookRequest(
      integration!.id,
      body,
      invalidSignature,
      "issues",
    ),
  ).toMatchObject({ success: false });
});

it.each([
  "{not-json",
  "null",
  JSON.stringify({ webhookSecret: 42 }),
  JSON.stringify({ webhookSecret: "" }),
  JSON.stringify({ webhookSecret: "   " }),
])(
  "generates a usable reconnect secret for unusable saved configuration %s",
  async (config) => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({ projectId: project.id, type: "gitea", isActive: true, config })
      .returning();
    const reconnected = await createGiteaIntegration({
      projectId: project.id,
      baseUrl: "https://git.example",
      accessToken: "explicit-test-token",
      repositoryOwner: "team",
      repositoryName: "repo",
      issueSyncMode: "off",
    });
    expect(reconnected.webhookSecret).toMatch(/^[a-f0-9]{48}$/);
    expect(reconnected.issueSyncMode).toBe("off");
    expect(verify).toHaveBeenCalledWith(
      "https://git.example",
      "explicit-test-token",
    );
    const saved = await db.query.integrationTable.findFirst({
      where: eq(schema.integrationTable.id, integration!.id),
    });
    expect(JSON.parse(saved!.config).webhookSecret).toBe(
      reconnected.webhookSecret,
    );
  },
);

it("does not bypass sync write permission verification when recovering a saved secret", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const config = JSON.stringify({
    baseUrl: "https://git.example",
    accessToken: "old-test-token",
    repositoryOwner: "team",
    repositoryName: "repo",
    webhookSecret: "test-only-existing-secret",
    issueSyncMode: "ingest-only",
    syncRules: { incoming: { mode: "invalid" } },
  });
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({ projectId: project.id, type: "gitea", isActive: true, config })
    .returning();
  await expect(
    createGiteaIntegration({
      projectId: project.id,
      baseUrl: "https://git.example",
      accessToken: "new-test-token",
      repositoryOwner: "team",
      repositoryName: "repo",
      issueSyncMode: "sync",
    }),
  ).rejects.toMatchObject({ status: 400 });
  expect(verify).toHaveBeenCalledWith("https://git.example", "new-test-token");
  const saved = await db.query.integrationTable.findFirst({
    where: eq(schema.integrationTable.id, integration!.id),
  });
  expect(saved!.config).toBe(config);
});
