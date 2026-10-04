import { and, eq, sql } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import * as events from "../../apps/api/src/events";
import { handleIssueOpened } from "../../apps/api/src/plugins/github/webhooks/issue-opened";
import { handleGiteaIssueOpened } from "../../apps/api/src/plugins/gitea/webhooks/issue-opened";
import { handleGitlabIssueOpened } from "../../apps/api/src/plugins/gitlab/webhooks/issue-opened";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const provider = vi.hoisted(() => ({ labels: vi.fn(), comment: vi.fn() }));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({
    getInstallationOctokit: async () => ({
      rest: { issues: { createComment: provider.comment } },
    }),
  }),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({ createIssueComment: provider.comment }),
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({ createIssueNote: provider.comment }),
}));
vi.mock("../../apps/api/src/plugins/github/utils/labels", () => ({
  addLabelsToIssue: async (...args: unknown[]) => {
    const write = args.at(-1);
    const send = () => provider.labels();
    return typeof write === "function" ? write(send) : send();
  },
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/labels", () => ({
  addLabelsToIssueGitea: async (...args: unknown[]) => {
    const write = args.at(-1);
    const send = () => provider.labels();
    return typeof write === "function" ? write(send) : send();
  },
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/labels", () => ({
  addLabelsToIssueGitlab: async (...args: unknown[]) => {
    const write = args.at(-1);
    const send = () => provider.labels();
    return typeof write === "function" ? write(send) : send();
  },
}));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  provider.labels.mockReset().mockResolvedValue(undefined);
  provider.comment.mockReset().mockResolvedValue({ id: 123 });
});

it.each(
  (["github", "gitea", "gitlab"] as const).flatMap((type) =>
    (
      [
        "excluded",
        "eligible",
        "before-write",
        "after-label",
        "failure",
      ] as const
    ).map((phase) => ({ type, phase })),
  ),
)(
  "guards $type issue-opened writes in the $phase case",
  async ({ type, phase }) => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [label] = await db
      .insert(schema.labelTable)
      .values({
        workspaceId: workspace.id,
        name: "export",
        color: "#123456",
      })
      .returning();
    const baseUrl =
      type === "github" ? "https://github.com" : `https://${type}.example`;
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type,
        isActive: true,
        config: JSON.stringify({
          baseUrl,
          repositoryOwner: "team",
          repositoryName: "repo",
          repositoryId: 1,
          installationId: 2,
          verifiedGithubAccountId: "3",
          verifiedByUserId: "test-user",
          accessToken: "test-only",
          projectPath: "team/repo",
          syncRules: {
            outgoing: { mode: "labels", match: "any", labels: [label!.id] },
            incoming: { mode: "all" },
          },
        }),
      })
      .returning();
    const removeQualifyingLabel = async () => {
      const task = await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.projectId, project.id),
      });
      await db
        .delete(schema.labelTable)
        .where(
          and(
            eq(schema.labelTable.taskId, task!.id),
            eq(schema.labelTable.name, "export"),
          ),
        );
    };
    const publish = vi
      .spyOn(events, "publishEvent")
      .mockImplementation(async (name) => {
        if (name === "task.created" && phase === "before-write")
          await removeQualifyingLabel();
      });
    if (phase === "after-label")
      provider.labels.mockImplementationOnce(async () => {
        await vi.waitFor(async () => {
          const activity = await db.execute<{ count: number }>(sql`
            select count(*)::int as count from pg_stat_activity
            where datname = current_database() and state = 'idle in transaction'
          `);
          expect(activity.rows[0]!.count).toBe(0);
        });
        await removeQualifyingLabel();
      });
    if (phase === "failure")
      provider.comment.mockRejectedValueOnce(
        Object.assign(new Error("private-provider-write-response"), {
          request: {
            headers: { authorization: "private-provider-write-token" },
          },
        }),
      );
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const labels =
      phase === "excluded"
        ? ["status:IN-PROGRESS"]
        : ["export", "status:IN-PROGRESS"];
    const issue = {
      number: 99,
      title: "Imported issue",
      body: "Imported body",
      html_url: `${baseUrl}/team/repo/issues/99`,
      labels,
      user: { login: "author" },
    };
    if (type === "github")
      await handleIssueOpened(
        {
          action: "opened",
          issue,
          installation: { id: 2 },
          repository: {
            id: 1,
            owner: { login: "team" },
            name: "repo",
            full_name: "team/repo",
          },
        },
        integration!.id,
      );
    else if (type === "gitea")
      await handleGiteaIssueOpened(
        {
          action: "opened",
          issue,
          repository: {
            owner: { login: "team" },
            name: "repo",
            html_url: `${baseUrl}/team/repo`,
          },
        },
        integration!.id,
      );
    else
      await handleGitlabIssueOpened(
        {
          object_attributes: {
            iid: 99,
            title: issue.title,
            description: issue.body,
            url: issue.html_url,
          },
          labels: labels.map((title) => ({ title })),
          project: {
            name: "repo",
            path_with_namespace: "team/repo",
            web_url: `${baseUrl}/team/repo`,
          },
        },
        integration!.id,
      );
    const tasks = await db.query.taskTable.findMany({
      where: eq(schema.taskTable.projectId, project.id),
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({ title: issue.title });
    const link = await db.query.externalLinkTable.findFirst({
      where: eq(schema.externalLinkTable.integrationId, integration!.id),
    });
    expect(link).toMatchObject({ taskId: tasks[0]!.id, externalId: "99" });
    expect(
      publish.mock.calls.filter(([name]) => name === "task.created"),
    ).toHaveLength(1);
    const paused = ["excluded", "before-write", "after-label"].includes(phase);
    expect(JSON.parse(link!.metadata!).syncFilterPaused === true).toBe(paused);
    expect(provider.labels).toHaveBeenCalledTimes(
      ["excluded", "before-write"].includes(phase) ? 0 : 1,
    );
    expect(provider.comment).toHaveBeenCalledTimes(paused ? 0 : 1);
    expect(JSON.stringify(log.mock.calls)).not.toContain(
      "private-provider-write",
    );
  },
);
