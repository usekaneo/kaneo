import { eq } from "drizzle-orm";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { giteaPlugin } from "../../apps/api/src/plugins/gitea";
import { handleGiteaIssueOpened } from "../../apps/api/src/plugins/gitea/webhooks/issue-opened";
import { githubPlugin } from "../../apps/api/src/plugins/github";
import { handleIssueOpened } from "../../apps/api/src/plugins/github/webhooks/issue-opened";
import { gitlabPlugin } from "../../apps/api/src/plugins/gitlab";
import { handleGitlabIssueOpened } from "../../apps/api/src/plugins/gitlab/webhooks/issue-opened";
import { registerPlugin } from "../../apps/api/src/plugins/registry";
import {
  reconcileProjectSync,
  reconcileTaskSync,
} from "../../apps/api/src/plugins/sync/reconcile";
import { canSyncTask } from "../../apps/api/src/plugins/sync/eligibility";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const mocks = vi.hoisted(() => ({
  githubCreate: vi.fn(),
  giteaCreate: vi.fn(),
  gitlabCreate: vi.fn(),
  update: vi.fn(),
  labels: vi.fn(),
  comment: vi.fn(),
}));
vi.mock("../../apps/api/src/plugins/github/utils/github-app", () => ({
  getGithubApp: () => ({
    getInstallationOctokit: async () => ({
      rest: { issues: { createComment: mocks.comment } },
    }),
  }),
  getVerifiedInstallationOctokit: async () => ({
    rest: {
      issues: {
        create: mocks.githubCreate,
        update: mocks.update,
        createComment: mocks.comment,
      },
    },
  }),
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/gitea-api", () => ({
  createGiteaClient: () => ({
    createIssue: mocks.giteaCreate,
    updateIssue: mocks.update,
    createIssueComment: mocks.comment,
  }),
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/gitlab-api", () => ({
  createGitlabClient: () => ({
    createIssue: mocks.gitlabCreate,
    updateIssue: mocks.update,
    createIssueNote: mocks.comment,
  }),
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
  registerPlugin(githubPlugin);
  registerPlugin(giteaPlugin);
  registerPlugin(gitlabPlugin);
});
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  mocks.githubCreate.mockResolvedValue({
    data: {
      number: 12,
      html_url: "https://github.com/team/repo/issues/12",
      title: "Export task",
      state: "open",
    },
  });
  mocks.giteaCreate.mockResolvedValue({
    number: 12,
    html_url: "https://git.example/team/repo/issues/12",
    title: "Export task",
    state: "open",
  });
  mocks.gitlabCreate.mockResolvedValue({
    iid: 12,
    web_url: "https://gitlab.example/team/repo/-/issues/12",
    title: "Export task",
    state: "opened",
  });
});
async function setup(type: "github" | "gitea" | "gitlab") {
  const { workspace } = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const [label] = await db
    .insert(schema.labelTable)
    .values({ workspaceId: workspace.id, name: "export", color: "#123456" })
    .returning();
  const config = {
    repositoryOwner: "team",
    repositoryName: "repo",
    repositoryId: 1,
    installationId: 2,
    verifiedGithubAccountId: "3",
    verifiedByUserId: "test-user",
    baseUrl:
      type === "gitlab" ? "https://gitlab.example" : "https://git.example",
    projectPath: "team/repo",
    accessToken: "fake-test-token",
    commentTaskLinkOnGitHubIssue: false,
    commentTaskLinkOnGiteaIssue: false,
    commentTaskLinkOnGitlabIssue: false,
    syncRules: {
      outgoing: { mode: "labels", match: "any", labels: [label!.id] },
      incoming: { mode: "labels", match: "any", labels: ["export"] },
    },
  };
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      type,
      projectId: project.id,
      isActive: true,
      config: JSON.stringify(config),
    })
    .returning();
  await db
    .update(schema.projectTable)
    .set({ lastTaskNumber: 1 })
    .where(eq(schema.projectTable.id, project.id));
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Export task",
      number: 1,
      status: "to-do",
      columnId: columns.todo.id,
    })
    .returning();
  const assign = () =>
    db.insert(schema.labelTable).values({
      taskId: task!.id,
      workspaceId: workspace.id,
      name: label!.name,
      color: label!.color,
    });
  return {
    workspace,
    columns,
    project,
    integration: integration!,
    task: task!,
    assign,
    config,
  };
}

describe.each(["github", "gitea", "gitlab"] as const)(
  "%s label-filtered sync",
  (type) => {
    const plugin = {
      github: githubPlugin,
      gitea: giteaPlugin,
      gitlab: gitlabPlugin,
    }[type];
    const create = {
      github: mocks.githubCreate,
      gitea: mocks.giteaCreate,
      gitlab: mocks.gitlabCreate,
    }[type];
    it("exports newly eligible tasks once, including their custom labels", async () => {
      const f = await setup(type);
      await reconcileProjectSync(f.project.id, f.integration.id);
      expect(create).not.toHaveBeenCalled();
      await f.assign();
      await Promise.all([
        reconcileTaskSync(f.project.id, f.task.id),
        reconcileProjectSync(f.project.id, f.integration.id),
      ]);
      expect(create).toHaveBeenCalledOnce();
      expect(mocks.labels.mock.calls[0]!.at(-1)).toContain("export");
      expect(
        await db.query.externalLinkTable.findMany({
          where: eq(schema.externalLinkTable.taskId, f.task.id),
        }),
      ).toHaveLength(1);
      await db
        .delete(schema.labelTable)
        .where(eq(schema.labelTable.taskId, f.task.id));
      await reconcileTaskSync(f.project.id, f.task.id);
      await plugin.onTaskTitleChanged!(
        {
          taskId: f.task.id,
          projectId: f.project.id,
          userId: null,
          oldTitle: "Export task",
          newTitle: "Excluded edit",
        },
        {
          integrationId: f.integration.id,
          projectId: f.project.id,
          config: f.config,
        },
      );
      expect(mocks.update).not.toHaveBeenCalled();
      await f.assign();
      await reconcileTaskSync(f.project.id, f.task.id);
      expect(create).toHaveBeenCalledOnce();
      expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
    });

    it("exports completed tasks with a closed issue and current link status", async () => {
      const f = await setup(type);
      await f.assign();
      await db
        .update(schema.taskTable)
        .set({ status: f.columns.done.slug, columnId: f.columns.done.id })
        .where(eq(schema.taskTable.id, f.task.id));
      await reconcileProjectSync(f.project.id, f.integration.id);
      expect(mocks.update).toHaveBeenCalledOnce();
      expect(mocks.update.mock.calls[0]!.at(-1)).toMatchObject(
        type === "gitlab" ? { state_event: "close" } : { state: "closed" },
      );
      const link = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      });
      expect(JSON.parse(link!.metadata!)).toMatchObject({ state: "closed" });
    });

    it("admits only matching repository issues and deduplicates concurrent webhooks", async () => {
      const f = await setup(type);
      async function receive(labels: string[]) {
        if (type === "github")
          return handleIssueOpened(
            {
              action: "opened",
              installation: { id: 2 },
              issue: {
                number: 99,
                title: "Repository issue",
                body: "Body",
                html_url: "https://github.com/team/repo/issues/99",
                labels,
                user: { login: "author" },
              },
              repository: {
                id: 1,
                owner: { login: "team" },
                name: "repo",
                full_name: "team/repo",
              },
            },
            f.integration.id,
          );
        if (type === "gitea")
          return handleGiteaIssueOpened(
            {
              action: "opened",
              issue: {
                number: 99,
                title: "Repository issue",
                body: "Body",
                html_url: "https://git.example/team/repo/issues/99",
                labels,
                user: { login: "author" },
              },
              repository: {
                owner: { login: "team" },
                name: "repo",
                html_url: "https://git.example/team/repo",
              },
            },
            f.integration.id,
          );
        return handleGitlabIssueOpened(
          {
            object_attributes: {
              iid: 99,
              title: "Repository issue",
              description: "Body",
              url: "https://gitlab.example/team/repo/-/issues/99",
            },
            labels: labels.map((title) => ({ title })),
            project: {
              name: "repo",
              path_with_namespace: "team/repo",
              web_url: "https://gitlab.example/team/repo",
            },
          },
          f.integration.id,
        );
      }
      await receive(["other"]);
      expect(await db.query.externalLinkTable.findMany()).toHaveLength(0);
      await Promise.all([receive(["export"]), receive(["export"])]);
      const links = await db.query.externalLinkTable.findMany();
      expect(links).toHaveLength(1);
      expect(links[0]!.externalId).toBe("99");
      expect(await canSyncTask(links[0]!.taskId, f.integration.id)).toBe(true);
      expect(
        await db.query.taskTable.findMany({
          where: eq(schema.taskTable.projectId, f.project.id),
        }),
      ).toHaveLength(2);
    });
  },
);

it("exports a burst larger than the database pool without exhausting lease connections", async () => {
  const f = await setup("gitea");
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      Array.from({ length: 20 }, (_, index) => ({
        projectId: f.project.id,
        number: index + 2,
        title: `Burst task ${index}`,
      })),
    )
    .returning();
  await db.insert(schema.labelTable).values(
    tasks.map((task) => ({
      workspaceId: f.workspace.id,
      taskId: task.id,
      name: "export",
      color: "#123456",
    })),
  );
  let number = 100;
  mocks.giteaCreate.mockImplementation(async () => ({
    number: ++number,
    title: "Burst issue",
    html_url: `https://git.example/team/repo/issues/${number}`,
    state: "open",
  }));
  await Promise.all(
    tasks.map((task) => reconcileTaskSync(f.project.id, task.id)),
  );
  expect(mocks.giteaCreate).toHaveBeenCalledTimes(20);
  expect(await db.query.externalLinkTable.findMany()).toHaveLength(20);
});
