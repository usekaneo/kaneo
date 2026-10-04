import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { handleIssueOpened } from "../../apps/api/src/plugins/github/webhooks/issue-opened";
import { handleGiteaIssueOpened } from "../../apps/api/src/plugins/gitea/webhooks/issue-opened";
import { handleGitlabIssueOpened } from "../../apps/api/src/plugins/gitlab/webhooks/issue-opened";
import { importGiteaIssues } from "../../apps/api/src/gitea-integration/controllers/import-gitea-issues";
import { importGitlabIssues } from "../../apps/api/src/gitlab-integration/controllers/import-gitlab-issues";
import { canSyncTask } from "../../apps/api/src/plugins/sync/eligibility";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const mocks = vi.hoisted(() => ({ issues: vi.fn(), publish: vi.fn() }));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    listIssues: mocks.issues,
    listPulls: async () => [],
    listIssueComments: async () => [],
  }),
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    listIssues: mocks.issues,
    listMergeRequests: async () => [],
    listIssueNotes: async () => [],
  }),
}));
vi.mock("../../apps/api/src/events", () => ({ publishEvent: mocks.publish }));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({
    getInstallationOctokit: async () => ({
      rest: { issues: { createComment: async () => {} } },
    }),
  }),
}));
beforeEach(async () => {
  await resetTestDatabase();
  mocks.issues.mockReset().mockResolvedValue([]);
  mocks.publish.mockReset().mockResolvedValue(undefined);
});

it.each(["gitea", "gitlab"] as const)(
  "%s manual refresh commits its final label eligibility before publishing",
  async (provider) => {
    const { workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [root] = await db
      .insert(schema.labelTable)
      .values({
        workspaceId: workspace.id,
        name: "export",
        color: "#123456",
      })
      .returning();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: provider,
        isActive: true,
        config: JSON.stringify({
          repositoryOwner: "team",
          repositoryName: "repo",
          baseUrl: "https://git.example",
          projectPath: "team/repo",
          accessToken: "fake-test-token",
          syncRules: {
            outgoing: { mode: "labels", match: "any", labels: [root.id] },
            incoming: { mode: "all" },
          },
        }),
      })
      .returning();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Existing task",
        number: 1,
      })
      .returning();
    await db.insert(schema.labelTable).values({
      workspaceId: workspace.id,
      taskId: task.id,
      name: root.name,
      color: root.color,
    });
    const [link] = await db
      .insert(schema.externalLinkTable)
      .values({
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "issue",
        externalId: "9",
        metadata: "{}",
        url: "https://git.example/team/repo/issues/9",
      })
      .returning();
    mocks.issues.mockResolvedValue([
      provider === "gitea"
        ? {
            number: 9,
            title: "Updated issue",
            body: "Body",
            state: "open",
            html_url: link.url,
            labels: [{ id: 2, name: "other", color: "123456" }],
          }
        : {
            iid: 9,
            title: "Updated issue",
            description: "Body",
            state: "opened",
            web_url: link.url,
            labels: ["other"],
          },
    ]);
    const pausedAtPublish: boolean[] = [];
    mocks.publish.mockImplementation(async () => {
      const stored = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, link.id),
      });
      pausedAtPublish.push(
        JSON.parse(stored!.metadata!).syncFilterPaused === true,
      );
    });
    expect(
      await (provider === "gitea" ? importGiteaIssues : importGitlabIssues)(
        project.id,
      ),
    ).toMatchObject({ updated: 1 });
    expect(pausedAtPublish).toEqual(Array(3).fill(provider === "gitea"));
    const labels = await db.query.labelTable.findMany({
      where: eq(schema.labelTable.taskId, task.id),
    });
    expect(labels.map((label) => label.name).includes("export")).toBe(
      provider === "gitlab",
    );
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ title: "Updated issue" });
  },
);

it.each(
  (["github", "gitea", "gitlab"] as const).flatMap((provider) =>
    [true, false].flatMap((qualifying) =>
      (provider === "github" ? ["webhook"] : ["webhook", "manual"]).map(
        (source) => ({ provider, qualifying, source }),
      ),
    ),
  ),
)(
  "$provider $source imports links with their committed outgoing scope (qualifying=$qualifying)",
  async ({ provider, qualifying, source }) => {
    const { workspace, user } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [label] = await db
      .insert(schema.labelTable)
      .values({ workspaceId: workspace.id, name: "export", color: "red" })
      .returning();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: project.id,
        type: provider,
        isActive: true,
        config: JSON.stringify({
          repositoryOwner: "team",
          repositoryName: "repo",
          repositoryId: 1,
          installationId: 2,
          verifiedGithubAccountId: "3",
          verifiedByUserId: user.id,
          baseUrl: "https://git.example",
          projectPath: "team/repo",
          accessToken: "fake-test-token",
          commentTaskLinkOnGitHubIssue: false,
          commentTaskLinkOnGiteaIssue: false,
          commentTaskLinkOnGitlabIssue: false,
          syncRules: {
            outgoing: { mode: "labels", match: "any", labels: [label.id] },
            incoming: { mode: "all" },
          },
        }),
      })
      .returning();
    const labels = qualifying ? ["export"] : ["other"];
    const issue = {
      number: 9,
      title: "Imported issue",
      body: "Body",
      html_url: "https://git.example/team/repo/issues/9",
      labels: labels.map((name) => ({ name, color: "1a2b3c" })),
      user: { login: "author" },
    };
    const repository = {
      id: 1,
      owner: { login: "team" },
      name: "repo",
      full_name: "team/repo",
      html_url: "https://git.example/team/repo",
    };
    if (source === "manual") {
      mocks.issues.mockResolvedValue([
        provider === "gitea"
          ? {
              ...issue,
              state: "open",
              labels: labels.map((name, id) => ({ id, name, color: "ff0000" })),
            }
          : {
              iid: 9,
              title: issue.title,
              description: "Body",
              web_url: issue.html_url,
              state: "opened",
              labels,
            },
      ]);
      expect(
        await (provider === "gitea" ? importGiteaIssues : importGitlabIssues)(
          project.id,
        ),
      ).toMatchObject({ imported: 1 });
    } else if (provider === "github")
      await handleIssueOpened(
        { action: "opened", installation: { id: 2 }, issue, repository },
        integration.id,
      );
    else if (provider === "gitea")
      await handleGiteaIssueOpened(
        { action: "opened", issue, repository },
        integration.id,
      );
    else
      await handleGitlabIssueOpened(
        {
          object_attributes: {
            iid: 9,
            title: issue.title,
            description: "Body",
            url: issue.html_url,
          },
          labels: labels.map((title) => ({ title, color: "#1a2b3c" })),
          project: {
            name: "repo",
            path_with_namespace: "team/repo",
            web_url: "https://git.example/team/repo",
          },
        },
        integration.id,
      );
    const link = (await db.query.externalLinkTable.findMany())[0]!;
    expect(link).toBeDefined();
    expect(JSON.parse(link.metadata!).syncFilterPaused === true).toBe(
      !qualifying,
    );
    const assigned = await db.query.labelTable.findFirst({
      where: eq(schema.labelTable.taskId, link.taskId),
    });
    expect(assigned?.color).toBe(
      qualifying
        ? label.color
        : source === "manual"
          ? provider === "gitea"
            ? "#ff0000"
            : "#6B7280"
          : "#1a2b3c",
    );
    if (!qualifying) {
      await db.insert(schema.labelTable).values({
        taskId: link.taskId,
        workspaceId: workspace.id,
        name: label.name,
        color: label.color,
      });
      expect(await canSyncTask(link.taskId, integration.id)).toBe(false);
      expect(
        await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, link.id),
        }),
      ).toMatchObject({ id: link.id, integrationId: integration.id });
    }
  },
);
