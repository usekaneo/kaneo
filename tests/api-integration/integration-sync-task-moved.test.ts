import { beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { githubPlugin } from "../../apps/api/src/plugins/github";
import { giteaPlugin } from "../../apps/api/src/plugins/gitea";
import { gitlabPlugin } from "../../apps/api/src/plugins/gitlab";
import {
  initializeEventSubscriptions,
  registerPlugin,
} from "../../apps/api/src/plugins/registry";
import * as reconciliation from "../../apps/api/src/plugins/sync/reconcile";
import moveTask from "../../apps/api/src/task/controllers/move-task";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const mocks = vi.hoisted(() => ({ create: vi.fn(), labels: vi.fn() }));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({}),
  getVerifiedInstallationOctokit: async () => ({
    rest: { issues: { create: mocks.create } },
  }),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({ createIssue: mocks.create }),
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({ createIssue: mocks.create }),
}));
vi.mock("../../apps/api/src/plugins/github/utils/labels", () => ({
  addLabelsToIssue: mocks.labels,
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/labels", () => ({
  addLabelsToIssueGitea: mocks.labels,
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/labels", () => ({
  addLabelsToIssueGitlab: mocks.labels,
}));

beforeAll(() => {
  for (const plugin of [githubPlugin, giteaPlugin, gitlabPlugin])
    registerPlugin(plugin);
  initializeEventSubscriptions();
});
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  const issue = {
    number: 12,
    iid: 12,
    html_url: "https://git.example/team/repo/issues/12",
    web_url: "https://git.example/team/repo/issues/12",
    title: "Moved task",
    state: "open",
  };
  mocks.create.mockResolvedValue({ ...issue, data: issue });
  mocks.labels.mockResolvedValue(undefined);
});

it.each(
  (["github", "gitea", "gitlab"] as const).flatMap((provider) =>
    [true, false].map((qualifying) => ({ provider, qualifying })),
  ),
)(
  "$provider reconciles moved tasks in the destination project (qualifying=$qualifying)",
  async ({ provider, qualifying }) => {
    const { workspace, user } = await createWorkspaceMember();
    const source = await createProjectFixture({ workspaceId: workspace.id });
    const destination = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [label] = await db
      .insert(schema.labelTable)
      .values({ workspaceId: workspace.id, name: "export", color: "#123456" })
      .returning();
    const [integration] = await db
      .insert(schema.integrationTable)
      .values({
        projectId: destination.project.id,
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
            outgoing: { mode: "labels", match: "any", labels: [label!.id] },
            incoming: { mode: "all" },
          },
        }),
      })
      .returning();
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: source.project.id,
        title: "Moved task",
        number: 1,
        status: "to-do",
        columnId: source.columns.todo.id,
      })
      .returning();
    if (qualifying)
      await db.insert(schema.labelTable).values({
        workspaceId: workspace.id,
        taskId: task!.id,
        name: "export",
        color: "#123456",
      });
    let completed!: () => void;
    const reconciled = new Promise<void>((resolve) => {
      completed = resolve;
    });
    const original = reconciliation.reconcileTaskSync;
    const handler = vi
      .spyOn(reconciliation, "reconcileTaskSync")
      .mockImplementationOnce(async (...args) => {
        try {
          await original(...args);
        } finally {
          completed();
        }
      });
    await moveTask({
      taskId: task!.id,
      destinationProjectId: destination.project.id,
      currentUserId: user.id,
    });
    await reconciled;
    expect(handler).toHaveBeenCalledWith(destination.project.id, task!.id);
    expect(mocks.create).toHaveBeenCalledTimes(qualifying ? 1 : 0);
    const links = await db.query.externalLinkTable.findMany();
    expect(links).toHaveLength(qualifying ? 1 : 0);
    if (qualifying)
      expect(links[0]).toMatchObject({
        taskId: task!.id,
        integrationId: integration!.id,
        resourceType: "issue",
        externalId: "12",
      });
  },
);
