import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { handleIssueClosed } from "../../apps/api/src/plugins/github/webhooks/issue-closed";
import { handleIssueReopened } from "../../apps/api/src/plugins/github/webhooks/issue-reopened";
import { handleGiteaIssueClosed } from "../../apps/api/src/plugins/gitea/webhooks/issue-closed";
import { handleGiteaIssueReopened } from "../../apps/api/src/plugins/gitea/webhooks/issue-reopened";
import { outboundStamp } from "../../apps/api/src/plugins/github/utils/sync-echo";
import { resetTestDatabase } from "./helpers/database";
import {
  createWorkspaceMember,
  createProjectFixture,
} from "./helpers/fixtures";
const m = vi.hoisted(() => ({ state: "open", integrations: [] as unknown[] }));
vi.mock("../../apps/api/src/events", () => ({
  publishEvent: vi.fn(async () => undefined),
}));
vi.mock(
  "../../apps/api/src/plugins/github/services/task-service",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/github/services/task-service")
    >()),
    findAllIntegrationsByRepo: async () => m.integrations,
  }),
);
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getVerifiedInstallationOctokit: async () => ({
    rest: { issues: { get: async () => ({ data: { state: m.state } }) } },
  }),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({ getIssue: async () => ({ state: m.state }) }),
}));
beforeEach(resetTestDatabase);
it.each(
  ["github", "gitea"].flatMap((provider) =>
    ["closed", "open"].map((delayed) => ({ provider, delayed })),
  ),
)(
  "$provider ignores a delayed $delayed state echo and accepts a later genuine edit",
  async ({ provider, delayed }) => {
    const current = delayed === "closed" ? "open" : "closed";
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        number: 1,
        title: "card",
        status: current === "closed" ? "done" : "to-do",
      })
      .returning();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: provider,
        config: JSON.stringify({
          baseUrl: "https://git.example",
          repositoryOwner: "owner",
          repositoryName: "repo",
          accessToken: "test-only",
        }),
      })
      .returning();
    m.integrations = [integration];
    m.state = current;
    const stamp = outboundStamp(
      outboundStamp(undefined, delayed, "2026-09-30T00:00:01Z"),
      current,
      "2026-09-30T00:00:02Z",
    );
    await db.insert(schema.externalLinkTable).values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: "https://git.example/owner/repo/issues/1",
      metadata: JSON.stringify({
        createdFrom: provider,
        state: current,
        lastSync: { state: stamp },
      }),
    });
    const payload = {
      action: delayed === "closed" ? "closed" : "reopened",
      issue: {
        number: 1,
        title: "card",
        html_url: "https://git.example/owner/repo/issues/1",
        state: delayed,
        updated_at: "2026-09-30T00:00:01Z",
      },
      repository: {
        id: 20,
        name: "repo",
        owner: { login: "owner" },
        full_name: "owner/repo",
        html_url: "https://git.example/owner/repo",
      },
    };
    const apply = async () => {
      if (provider === "github")
        await (delayed === "closed" ? handleIssueClosed : handleIssueReopened)(
          payload,
        );
      else
        await (
          delayed === "closed"
            ? handleGiteaIssueClosed
            : handleGiteaIssueReopened
        )(payload, integration.id);
    };
    await apply();
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.status,
    ).toBe(current === "closed" ? "done" : "to-do");
    m.state = delayed;
    payload.issue.updated_at = "2026-09-30T00:00:03Z";
    await apply();
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, task.id),
        })
      )?.status,
    ).toBe(delayed === "closed" ? "done" : "to-do");
  },
);
