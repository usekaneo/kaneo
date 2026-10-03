import { eq, sql } from "drizzle-orm";
import {
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import * as events from "../../apps/api/src/events";
import db, { getDatabasePool, schema } from "../../apps/api/src/database";
import { giteaPlugin } from "../../apps/api/src/plugins/gitea";
import { handleGiteaIssueLabeled } from "../../apps/api/src/plugins/gitea/webhooks/issue-labeled";
import { handleIssueLabeled } from "../../apps/api/src/plugins/github/webhooks/issue-labeled";
import { handleGitlabIssueUpdated } from "../../apps/api/src/plugins/gitlab/webhooks/issue-updated";
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
import { getSyncIntegration } from "../../apps/api/src/integration-sync/controllers/get-integration";
import { previewSyncRules } from "../../apps/api/src/integration-sync/controllers/preview-rules";
import type { SyncRules } from "../../apps/api/src/plugins/sync/rules";
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
    it("exports equivalent formatted configurations while rejecting real changes", async () => {
      const f = await setup(type);
      await f.assign();
      await db
        .update(schema.integrationTable)
        .set({ config: JSON.stringify(f.config, null, 2) })
        .where(eq(schema.integrationTable.id, f.integration.id));
      const reordered = Object.fromEntries(Object.entries(f.config).reverse());
      expect(
        await canSyncTask(
          f.task.id,
          f.integration.id,
          undefined,
          JSON.stringify(reordered),
        ),
      ).toBe(true);
      expect(
        await canSyncTask(
          f.task.id,
          f.integration.id,
          undefined,
          JSON.stringify({ ...f.config, accessToken: "changed-test-token" }),
        ),
      ).toBe(false);
      expect(
        await canSyncTask(
          f.task.id,
          f.integration.id,
          undefined,
          JSON.stringify({
            ...f.config,
            syncRules: { ...f.config.syncRules, outgoing: { mode: "all" } },
          }),
        ),
      ).toBe(false);
      await reconcileProjectSync(f.project.id, f.integration.id);
      expect(create).toHaveBeenCalledOnce();
    });
    it("exports newly eligible tasks once, including their custom labels", async () => {
      const f = await setup(type);
      await reconcileProjectSync(f.project.id, f.integration.id);
      expect(create).not.toHaveBeenCalled();
      await f.assign();
      await db.insert(schema.labelTable).values(
        ["status:done", "priority:high"].map((name) => ({
          taskId: f.task.id,
          workspaceId: f.workspace.id,
          name,
          color: "#123456",
        })),
      );
      await Promise.all([
        reconcileTaskSync(f.project.id, f.task.id),
        reconcileProjectSync(f.project.id, f.integration.id),
      ]);
      expect(create).toHaveBeenCalledOnce();
      expect(mocks.labels.mock.calls[0]!.at(-1)).toContain("export");
      expect(mocks.labels.mock.calls[0]!.at(-1)).toContain("status:to-do");
      expect(mocks.labels.mock.calls[0]!.at(-1)).not.toContain("status:done");
      expect(mocks.labels.mock.calls[0]!.at(-1)).not.toContain("priority:high");
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

    it.each(["labels", "rules", "deactivation"])(
      "pauses a dispatched creation after %s change without follow-up writes",
      async (change) => {
        const f = await setup(type);
        await f.assign();
        await db
          .update(schema.taskTable)
          .set({ status: f.columns.done.slug, columnId: f.columns.done.id })
          .where(eq(schema.taskTable.id, f.task.id));
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        create.mockImplementationOnce(async () => {
          await gate;
          const issue = {
            number: 12,
            iid: 12,
            title: "Export task",
            state: type === "gitlab" ? "opened" : "open",
            html_url: "https://git.example/issues/12",
            web_url: "https://git.example/issues/12",
          };
          return type === "github" ? { data: issue } : issue;
        });
        const exportTask = reconcileTaskSync(f.project.id, f.task.id);
        try {
          await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
          if (change === "labels")
            await db
              .delete(schema.labelTable)
              .where(eq(schema.labelTable.taskId, f.task.id));
          else if (change === "deactivation")
            await db
              .update(schema.integrationTable)
              .set({ isActive: false })
              .where(eq(schema.integrationTable.id, f.integration.id));
          else
            await db
              .update(schema.integrationTable)
              .set({
                config: JSON.stringify({
                  ...f.config,
                  syncRules: {
                    ...f.config.syncRules,
                    outgoing: {
                      mode: "labels",
                      match: "any",
                      labels: ["missing-label"],
                    },
                  },
                }),
              })
              .where(eq(schema.integrationTable.id, f.integration.id));
        } finally {
          release();
          await exportTask;
        }
        const link = await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.taskId, f.task.id),
        });
        expect(JSON.parse(link!.metadata!)).toMatchObject({
          syncFilterPaused: true,
        });
        expect(mocks.update).not.toHaveBeenCalled();
        expect(mocks.labels).not.toHaveBeenCalled();
        expect(mocks.comment).not.toHaveBeenCalled();
        expect(create).toHaveBeenCalledOnce();
      },
    );

    it("imports a closed issue gaining a label into a completed column", async () => {
      const f = await setup(type);
      if (type === "github") {
        const payload = {
          action: "labeled",
          installation: { id: 2 },
          issue: {
            number: 99,
            title: "Closed issue",
            body: "Body",
            state: "closed",
            html_url: "https://github.com/team/repo/issues/99",
            labels: ["export"],
            user: { login: "author" },
          },
          repository: {
            id: 1,
            owner: { login: "team" },
            name: "repo",
            full_name: "team/repo",
          },
        };
        await handleIssueLabeled(payload);
      } else if (type === "gitea") {
        const payload = {
          action: "label_updated",
          issue: {
            number: 99,
            title: "Closed issue",
            body: "Body",
            state: "closed",
            html_url: "https://git.example/team/repo/issues/99",
            labels: ["export"],
            user: { login: "author" },
          },
          repository: {
            owner: { login: "team" },
            name: "repo",
            html_url: "https://git.example/team/repo",
          },
        };
        await handleGiteaIssueLabeled(payload, f.integration.id);
      } else {
        // GitLab can send the authoritative labels only inside the change.
        await handleGitlabIssueUpdated(
          {
            object_attributes: {
              iid: 99,
              title: "Closed issue",
              description: "Body",
              state: "closed",
              url: "https://gitlab.example/team/repo/-/issues/99",
            },
            changes: {
              labels: { previous: [], current: [{ title: "export" }] },
            },
            project: {
              name: "repo",
              path_with_namespace: "team/repo",
              web_url: "https://gitlab.example/team/repo",
            },
          },
          f.integration.id,
        );
      }
      const link = (await db.query.externalLinkTable.findMany())[0]!;
      expect(JSON.parse(link.metadata!)).toMatchObject({ state: "closed" });
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, link.taskId),
        }),
      ).toMatchObject({
        columnId: f.columns.done.id,
        status: f.columns.done.slug,
      });
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

it("lets an unrelated export proceed while another provider call is slow", async () => {
  const f = await setup("gitea");
  await f.assign();
  const [other] = await db
    .insert(schema.taskTable)
    .values({ projectId: f.project.id, number: 2, title: "Fast task" })
    .returning();
  await db.insert(schema.labelTable).values({
    taskId: other!.id,
    workspaceId: f.workspace.id,
    name: "export",
    color: "#123456",
  });
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  mocks.giteaCreate.mockImplementationOnce(async () => {
    await gate;
    return {
      number: 12,
      html_url: "https://git.example/issues/12",
      title: "Slow issue",
      state: "open",
    };
  });
  mocks.giteaCreate.mockResolvedValueOnce({
    number: 13,
    html_url: "https://git.example/issues/13",
    title: "Fast issue",
    state: "open",
  });
  const slow = reconcileTaskSync(f.project.id, f.task.id);
  try {
    await vi.waitFor(() => expect(mocks.giteaCreate).toHaveBeenCalledTimes(1));
    await reconcileTaskSync(f.project.id, other!.id);
    expect(
      await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.taskId, other!.id),
      }),
    ).toBeTruthy();
  } finally {
    release();
    await slow;
  }
});

it("retries a competing creation after the first attempt fails", async () => {
  const f = await setup("gitea");
  await f.assign();
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  mocks.giteaCreate.mockImplementationOnce(async () => {
    await gate;
    throw new Error("Temporary provider failure");
  });
  const first = reconcileTaskSync(f.project.id, f.task.id);
  await vi.waitFor(() => expect(mocks.giteaCreate).toHaveBeenCalledTimes(1));
  const competing = reconcileTaskSync(f.project.id, f.task.id);
  release();
  await Promise.all([first, competing]);
  expect(mocks.giteaCreate).toHaveBeenCalledTimes(2);
  expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
});

it("runs task creation HTTP calls without an idle database transaction", async () => {
  const f = await setup("gitea");
  await f.assign();
  mocks.giteaCreate.mockImplementationOnce(async () => {
    const result = await db.execute<{ transactions: string }>(sql`
      select count(*)::text as transactions from pg_stat_activity
      where datname = current_database() and pid <> pg_backend_pid() and state = 'idle in transaction'
    `);
    expect(result.rows[0]!.transactions).toBe("0");
    return {
      number: 12,
      html_url: "https://git.example/issues/12",
      title: "Export task",
      state: "open",
    };
  });
  await reconcileTaskSync(f.project.id, f.task.id);
  expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
});

it("waits for another instance's creation lease instead of dropping the export", async () => {
  const f = await setup("gitea");
  await f.assign();
  const key = `sync-create:${f.integration.id}:${f.task.id}`;
  const holder = await getDatabasePool().connect();
  await holder.query("select pg_advisory_lock(hashtextextended($1, 0))", [key]);
  const competing = reconcileTaskSync(f.project.id, f.task.id);
  try {
    await vi.waitFor(async () => {
      const result = await db.execute<{ waiting: number }>(sql`
        select count(*)::int as waiting from pg_stat_activity
        where datname = current_database() and wait_event = 'advisory'
      `);
      expect(result.rows[0]!.waiting).toBeGreaterThan(0);
    });
    expect(mocks.giteaCreate).not.toHaveBeenCalled();
  } finally {
    await holder.query("select pg_advisory_unlock(hashtextextended($1, 0))", [
      key,
    ]);
    holder.release();
    await competing;
  }
  expect(mocks.giteaCreate).toHaveBeenCalledOnce();
  expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
});

it("broadcasts only changed links and avoids task scans for unconfigured integrations", async () => {
  const f = await setup("gitea");
  const publish = vi.spyOn(events, "publishEvent");
  await reconcileProjectSync(f.project.id);
  expect(publish).not.toHaveBeenCalled();
  await f.assign();
  await reconcileTaskSync(f.project.id, f.task.id);
  expect(publish).toHaveBeenCalledOnce();
  publish.mockClear();
  await reconcileProjectSync(f.project.id);
  expect(publish).not.toHaveBeenCalled();
  const { syncRules: _, ...legacy } = f.config;
  await db
    .update(schema.integrationTable)
    .set({ config: JSON.stringify(legacy) })
    .where(eq(schema.integrationTable.id, f.integration.id));
  const query = vi.spyOn(getDatabasePool(), "query");
  await reconcileProjectSync(f.project.id);
  expect(
    query.mock.calls.every((call) => {
      const first = call[0] as unknown as string | { text: string };
      return !(typeof first === "string" ? first : first.text).includes(
        'from "task"',
      );
    }),
  ).toBe(true);
  expect(publish).not.toHaveBeenCalled();
});

it("continues after a task export throws and leaves failed tasks available for explicit retry", async () => {
  const f = await setup("gitea");
  await f.assign();
  const [other] = await db
    .insert(schema.taskTable)
    .values({
      projectId: f.project.id,
      title: "Other task",
      number: 2,
      status: f.columns.todo.slug,
      columnId: f.columns.todo.id,
    })
    .returning();
  await db.insert(schema.labelTable).values({
    taskId: other!.id,
    workspaceId: f.workspace.id,
    name: "export",
    color: "#123456",
  });
  const handler = vi
    .spyOn(giteaPlugin, "onTaskCreated")
    .mockRejectedValueOnce(new Error("Test creation lease failed"));
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  try {
    await reconcileProjectSync(f.project.id, f.integration.id);
    expect(mocks.giteaCreate).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith(
      "Task sync reconciliation failed",
      expect.objectContaining({ integrationId: f.integration.id }),
    );
    const integration = await getSyncIntegration(f.project.id, "gitea");
    expect(
      (await previewSyncRules(integration, f.config.syncRules as SyncRules))
        .willCreate,
    ).toBe(1);
    const linked = await db.query.externalLinkTable.findMany();
    expect(linked).toHaveLength(1);
    mocks.giteaCreate.mockResolvedValueOnce({
      number: 13,
      html_url: "https://git.example/team/repo/issues/13",
      title: "Retried task",
      state: "open",
    });
    await reconcileProjectSync(f.project.id, f.integration.id);
    expect(mocks.giteaCreate).toHaveBeenCalledTimes(2);
    expect(
      (await previewSyncRules(integration, f.config.syncRules as SyncRules))
        .willCreate,
    ).toBe(0);
  } finally {
    handler.mockRestore();
    log.mockRestore();
  }
});
