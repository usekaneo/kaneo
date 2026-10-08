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
import db, {
  getDatabase,
  getDatabasePool,
  schema,
} from "../../apps/api/src/database";
import { syncLatestTaskValue } from "../../apps/api/src/plugins/github/services/sync-latest-task-value";
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
import * as eligibility from "../../apps/api/src/plugins/sync/eligibility";
import { resumeSync } from "../../apps/api/src/integration-sync/controllers/resume-sync";
import { reviewSyncResume } from "../../apps/api/src/integration-sync/controllers/review-resume";
import { updateExternalLink } from "../../apps/api/src/plugins/github/services/link-manager";
import deleteLabel from "../../apps/api/src/label/controllers/delete-label";
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
  comments: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
}));
vi.mock("../../apps/api/src/plugins/sync/provider-issue", () => ({
  providerIssue: async () => ({ read: mocks.read, write: mocks.write }),
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
        listComments: mocks.comments,
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
  removeLabel: async () => {},
}));
vi.mock("../../apps/api/src/plugins/gitea/utils/labels", () => ({
  addLabelsToIssueGitea: mocks.labels,
  removeLabelGitea: async () => {},
}));
vi.mock("../../apps/api/src/plugins/gitlab/utils/labels", () => ({
  addLabelsToIssueGitlab: mocks.labels,
  updateIssueLabelsGitlab: (
    config: unknown,
    number: number,
    changes: { add: string[] },
    ...args: unknown[]
  ) => mocks.labels(config, number, changes.add, ...args),
}));

beforeAll(() => {
  registerPlugin(githubPlugin);
  registerPlugin(giteaPlugin);
  registerPlugin(gitlabPlugin);
});
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  mocks.update.mockResolvedValue(undefined);
  mocks.labels.mockResolvedValue(undefined);
  mocks.comment.mockResolvedValue({ id: 123 });
  mocks.comments.mockReset().mockResolvedValue({ data: [] });
  mocks.read.mockResolvedValue({
    title: "Repository title",
    description: "Repository body",
    state: "open",
    updatedAt: "2026-01-01T00:00:00Z",
    labels: ["export", "priority:low", "status:to-do", "remote-old"],
  });
  mocks.write.mockImplementation(async (values) => {
    const current = await mocks.read.mock.results.at(-1)!.value;
    mocks.read.mockResolvedValue({
      ...current,
      ...values,
      updatedAt: "2026-01-02T00:00:00Z",
    });
    return { updatedAt: "2026-01-02T00:00:00Z" };
  });
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
    it("commits an inbound scope-label removal with a paused link before publishing", async () => {
      const f = await setup(type);
      await f.assign();
      await reconcileTaskSync(f.project.id, f.task.id);
      const link = (await db.query.externalLinkTable.findMany())[0]!;
      const publish = vi
        .spyOn(events, "publishEvent")
        .mockResolvedValue(undefined);
      try {
        if (type === "github")
          await handleIssueLabeled({
            action: "unlabeled",
            installation: { id: 2 },
            repository: { id: 1, owner: { login: "team" }, name: "repo" },
            issue: { number: 12, labels: [] },
            label: { name: "export", color: "123456" },
          });
        else if (type === "gitea")
          await handleGiteaIssueLabeled(
            {
              action: "label_updated",
              repository: {
                owner: { login: "team" },
                name: "repo",
                html_url: "https://git.example/team/repo",
              },
              issue: { number: 12, labels: [] },
            },
            f.integration.id,
          );
        else
          await handleGitlabIssueUpdated(
            {
              object_attributes: {
                iid: 12,
                title: "Export task",
                description: "",
                state: "opened",
                url: "https://gitlab.example/team/repo/-/issues/12",
              },
              changes: {
                labels: { previous: [{ title: "export" }], current: [] },
              },
              project: {
                name: "repo",
                path_with_namespace: "team/repo",
                web_url: "https://gitlab.example/team/repo",
              },
            },
            f.integration.id,
          );
        expect(
          await db.query.labelTable.findMany({
            where: eq(schema.labelTable.taskId, f.task.id),
          }),
        ).toEqual([]);
        const paused = await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, link.id),
        });
        expect(JSON.parse(paused!.metadata!)).toMatchObject({
          syncFilterPaused: true,
        });
        await f.assign();
        expect(await canSyncTask(f.task.id, f.integration.id)).toBe(false);
      } finally {
        publish.mockRestore();
      }
    });
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
    it("skips completed links and excluded unlinked tasks, while still pausing excluded links", async () => {
      const f = await setup(type);
      await f.assign();
      await reconcileTaskSync(f.project.id, f.task.id);
      await db.insert(schema.taskTable).values(
        Array.from({ length: 30 }, (_, index) => ({
          projectId: f.project.id,
          title: "Unmatched task",
          number: index + 2,
          status: "to-do",
        })),
      );
      const guard = vi.spyOn(eligibility, "canSyncTask");
      const publish = vi.spyOn(events, "publishEvent");
      await reconcileProjectSync(f.project.id, f.integration.id);
      expect(guard).not.toHaveBeenCalled();
      expect(publish).not.toHaveBeenCalled();
      await db
        .delete(schema.labelTable)
        .where(eq(schema.labelTable.taskId, f.task.id));
      await reconcileProjectSync(f.project.id, f.integration.id);
      expect(guard).toHaveBeenCalledOnce();
      const link = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      });
      expect(JSON.parse(link!.metadata!)).toMatchObject({
        syncFilterPaused: true,
      });
      expect(
        publish.mock.calls.filter(([name]) => name === "project.updated"),
      ).toHaveLength(1);
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
      expect(mocks.labels.mock.calls[0]![type === "github" ? 4 : 2]).toContain(
        "export",
      );
      expect(mocks.labels.mock.calls[0]![type === "github" ? 4 : 2]).toContain(
        "status:to-do",
      );
      expect(
        mocks.labels.mock.calls[0]![type === "github" ? 4 : 2],
      ).not.toContain("status:done");
      expect(
        mocks.labels.mock.calls[0]![type === "github" ? 4 : 2],
      ).not.toContain("priority:high");
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

    it("reopens and closes exported issues when moving out of and into a custom final column", async () => {
      const f = await setup(type);
      await f.assign();
      const [final] = await db
        .insert(schema.columnTable)
        .values({
          projectId: f.project.id,
          name: "Shipped",
          slug: "shipped",
          position: 99,
          isFinal: true,
        })
        .returning();
      await db
        .update(schema.taskTable)
        .set({ status: final.slug, columnId: final.id })
        .where(eq(schema.taskTable.id, f.task.id));
      await reconcileProjectSync(f.project.id, f.integration.id);
      expect(mocks.update.mock.calls[0]!.at(-1)).toMatchObject(
        type === "gitlab" ? { state_event: "close" } : { state: "closed" },
      );
      mocks.update.mockClear();
      const context = {
        integrationId: f.integration.id,
        projectId: f.project.id,
        config: f.config,
      };
      const changeStatus = async (
        oldStatus: string,
        newStatus: string,
        columnId: string,
      ) => {
        await db
          .update(schema.taskTable)
          .set({ status: newStatus, columnId })
          .where(eq(schema.taskTable.id, f.task.id));
        await plugin.onTaskStatusChanged!(
          {
            taskId: f.task.id,
            projectId: f.project.id,
            userId: null,
            title: f.task.title,
            oldStatus,
            newStatus,
          },
          context,
        );
      };
      await changeStatus(final.slug, f.columns.todo.slug, f.columns.todo.id);
      expect(mocks.update).toHaveBeenCalledOnce();
      expect(mocks.update.mock.calls[0]!.at(-1)).toMatchObject(
        type === "gitlab" ? { state_event: "reopen" } : { state: "open" },
      );
      await changeStatus(f.columns.todo.slug, final.slug, final.id);
      expect(mocks.update).toHaveBeenCalledTimes(2);
      expect(mocks.update.mock.calls[1]!.at(-1)).toMatchObject(
        type === "gitlab" ? { state_event: "close" } : { state: "closed" },
      );
    });

    it("repairs a late initialization close after a concurrent reopen", async () => {
      const f = await setup(type);
      await f.assign();
      await db
        .update(schema.taskTable)
        .set({ status: f.columns.done.slug, columnId: f.columns.done.id })
        .where(eq(schema.taskTable.id, f.task.id));
      let started!: () => void;
      let release!: () => void;
      const dispatched = new Promise<void>((resolve) => {
        started = resolve;
      });
      const gate = new Promise<void>((resolve) => {
        release = resolve;
      });
      let firstClose = true;
      let remoteState = "open";
      mocks.update.mockImplementation(async (...args: unknown[]) => {
        const patch = args.at(-1) as { state?: string; state_event?: string };
        const state =
          patch.state ?? (patch.state_event === "close" ? "closed" : "open");
        if (state === "closed" && firstClose) {
          firstClose = false;
          started();
          await gate;
        }
        remoteState = state;
      });
      const exporting = reconcileTaskSync(f.project.id, f.task.id);
      try {
        await dispatched;
        await db.transaction(async (tx) => {
          await tx.execute(sql`set local lock_timeout = '1s'`);
          await tx
            .update(schema.taskTable)
            .set({ status: f.columns.todo.slug, columnId: f.columns.todo.id })
            .where(eq(schema.taskTable.id, f.task.id));
        });
        await plugin.onTaskStatusChanged!(
          {
            taskId: f.task.id,
            projectId: f.project.id,
            userId: null,
            title: f.task.title,
            oldStatus: f.columns.done.slug,
            newStatus: f.columns.todo.slug,
          },
          {
            integrationId: f.integration.id,
            projectId: f.project.id,
            config: f.config,
          },
        );
        expect(remoteState).toBe("open");
      } finally {
        release();
        await exporting;
      }
      expect(remoteState).toBe("open");
      const link = (await db.query.externalLinkTable.findMany())[0]!;
      expect(JSON.parse(link.metadata!)).toMatchObject({
        state: "open",
        syncInitializedState: true,
        syncInitializationPending: false,
      });
    });

    it("retries an uncertain initialization close as open after the task changes", async () => {
      const f = await setup(type);
      await f.assign();
      await db
        .update(schema.taskTable)
        .set({ status: f.columns.done.slug, columnId: f.columns.done.id })
        .where(eq(schema.taskTable.id, f.task.id));
      let remoteState = "open";
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      mocks.update.mockImplementationOnce(async () => {
        remoteState = "closed";
        throw new Error("private-state-response-token");
      });
      await reconcileTaskSync(f.project.id, f.task.id);
      const link = (await db.query.externalLinkTable.findMany())[0]!;
      expect(JSON.parse(link.metadata!)).toMatchObject({
        syncInitializationPending: true,
      });
      expect(JSON.parse(link.metadata!).syncInitializedState).not.toBe(true);
      expect(remoteState).toBe("closed");
      expect(JSON.stringify(log.mock.calls)).not.toContain(
        "private-state-response-token",
      );
      await db
        .update(schema.taskTable)
        .set({ status: f.columns.todo.slug, columnId: f.columns.todo.id })
        .where(eq(schema.taskTable.id, f.task.id));
      mocks.update.mockImplementation(async (...args: unknown[]) => {
        const patch = args.at(-1) as { state?: string; state_event?: string };
        remoteState =
          patch.state ?? (patch.state_event === "close" ? "closed" : "open");
      });
      await reconcileProjectSync(f.project.id, f.integration.id);
      expect(create).toHaveBeenCalledOnce();
      expect(remoteState).toBe("open");
      expect(
        JSON.parse((await db.query.externalLinkTable.findFirst())!.metadata!),
      ).toMatchObject({
        state: "open",
        syncInitializedState: true,
        syncInitializationPending: false,
      });
    });

    it.each([false, true])(
      "replays edits made during creation and retries failed text initialization (failure=%s)",
      async (failure) => {
        const f = await setup(type);
        await f.assign();
        let release!: () => void;
        const gate = new Promise<void>((resolve) => {
          release = resolve;
        });
        const response = await create.getMockImplementation()!();
        create.mockImplementationOnce(async () => {
          await gate;
          return response;
        });
        if (failure)
          mocks.update.mockRejectedValueOnce(
            new Error("Temporary text initialization failure"),
          );
        const exportTask = reconcileTaskSync(f.project.id, f.task.id);
        try {
          await vi.waitFor(() => expect(create).toHaveBeenCalledOnce());
          await db
            .update(schema.taskTable)
            .set({
              title: "Edited title",
              description: "Edited description",
              status: f.columns.done.slug,
              columnId: f.columns.done.id,
              priority: "urgent",
            })
            .where(eq(schema.taskTable.id, f.task.id));
        } finally {
          release();
          await exportTask;
        }
        if (failure) {
          const link = (await db.query.externalLinkTable.findMany())[0]!;
          expect(JSON.parse(link.metadata!)).toMatchObject({
            syncInitializationPending: true,
          });
          await reconcileTaskSync(f.project.id, f.task.id);
        }
        expect(create).toHaveBeenCalledOnce();
        const updates = mocks.update.mock.calls.map((call) => call.at(-1));
        expect(updates).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ title: "Edited title" }),
            expect.objectContaining(
              type === "gitlab"
                ? { description: expect.stringContaining("Edited description") }
                : { body: expect.stringContaining("Edited description") },
            ),
            expect.objectContaining(
              type === "gitlab"
                ? { state_event: "close" }
                : { state: "closed" },
            ),
          ]),
        );
        const names = mocks.labels.mock.calls[0]![type === "github" ? 4 : 2];
        expect(names).toEqual(
          expect.arrayContaining(["priority:urgent", "status:done"]),
        );
        expect(names).not.toContain("status:to-do");
        const link = (await db.query.externalLinkTable.findMany())[0]!;
        expect(link.title).toBe("Edited title");
        expect(JSON.parse(link.metadata!)).toMatchObject({
          syncInitializationPending: false,
          syncInitializedText: {
            title: "Edited title",
            description: "Edited description",
          },
          state: "closed",
        });
      },
    );

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

    it.each(
      type === "github"
        ? (["state", "labels", "comment"] as const)
        : (["state", "labels"] as const),
    )(
      "retries incomplete %s initialization without recreating the issue",
      async (stage) => {
        const f = await setup(type);
        await f.assign();
        if (stage === "comment") {
          f.config.commentTaskLinkOnGitHubIssue = true;
          await db
            .update(schema.integrationTable)
            .set({ config: JSON.stringify(f.config) })
            .where(eq(schema.integrationTable.id, f.integration.id));
        }
        await db
          .update(schema.taskTable)
          .set({ status: f.columns.done.slug, columnId: f.columns.done.id })
          .where(eq(schema.taskTable.id, f.task.id));
        const failing = {
          state: mocks.update,
          labels: mocks.labels,
          comment: mocks.comment,
        }[stage];
        failing.mockRejectedValueOnce(
          new Error("Temporary initialization failure"),
        );
        await reconcileTaskSync(f.project.id, f.task.id);
        const integration = await getSyncIntegration(f.project.id, type);
        expect(
          (await previewSyncRules(integration, f.config.syncRules as SyncRules))
            .willCreate,
        ).toBe(1);
        const link = await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.taskId, f.task.id),
        });
        expect(JSON.parse(link!.metadata!)).toMatchObject({
          syncInitializationPending: true,
        });
        await reconcileTaskSync(f.project.id, f.task.id);
        expect(create).toHaveBeenCalledOnce();
        expect(failing).toHaveBeenCalledTimes(2);
        expect(
          (await previewSyncRules(integration, f.config.syncRules as SyncRules))
            .willCreate,
        ).toBe(0);
        expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
      },
    );

    if (type === "github")
      it.each([
        "first-page",
        "later-page",
        "read-failure",
        "scope-loss",
      ] as const)(
        "reconciles an accepted comment with a lost response (%s) before retrying",
        async (scenario) => {
          const f = await setup(type);
          await f.assign();
          f.config.commentTaskLinkOnGitHubIssue = true;
          await db
            .update(schema.integrationTable)
            .set({ config: JSON.stringify(f.config) })
            .where(eq(schema.integrationTable.id, f.integration.id));
          let deliveredBody = "";
          mocks.comment.mockImplementationOnce(async ({ body }) => {
            deliveredBody = body;
            throw new Error("Comment accepted but its response was lost");
          });
          await reconcileTaskSync(f.project.id, f.task.id);
          const link = (await db.query.externalLinkTable.findMany())[0]!;
          expect(JSON.parse(link.metadata!)).toMatchObject({
            syncInitializationPending: true,
          });
          mocks.comments.mockImplementation(async ({ page }) => {
            const activity = await db.execute<{ count: number }>(sql`
              select count(*)::int as count from pg_stat_activity
              where datname = current_database() and state = 'idle in transaction'
            `);
            expect(activity.rows[0]!.count).toBe(0);
            if (scenario === "scope-loss") {
              await db
                .delete(schema.labelTable)
                .where(eq(schema.labelTable.taskId, f.task.id));
              return { data: [] };
            }
            return {
              data:
                scenario === "later-page" && page === 1
                  ? Array.from({ length: 100 }, () => ({
                      body: "Other comment",
                    }))
                  : [{ body: deliveredBody }],
            };
          });
          if (scenario === "read-failure") {
            const log = vi.spyOn(console, "error").mockImplementation(() => {});
            mocks.comments.mockRejectedValueOnce(
              Object.assign(new Error("Read unavailable"), {
                request: {
                  headers: { authorization: "private-provider-token" },
                },
              }),
            );
            try {
              await reconcileTaskSync(f.project.id, f.task.id);
              expect(JSON.stringify(log.mock.calls)).not.toContain(
                "private-provider-token",
              );
            } finally {
              log.mockRestore();
            }
            expect(mocks.comment).toHaveBeenCalledOnce();
            const pending = await db.query.externalLinkTable.findFirst({
              where: eq(schema.externalLinkTable.id, link.id),
            });
            expect(JSON.parse(pending!.metadata!)).toMatchObject({
              syncInitializationPending: true,
            });
          }
          await reconcileTaskSync(f.project.id, f.task.id);
          expect(mocks.githubCreate).toHaveBeenCalledOnce();
          expect(mocks.comment).toHaveBeenCalledOnce();
          expect(mocks.comments).toHaveBeenCalled();
          const completed = await db.query.externalLinkTable.findFirst({
            where: eq(schema.externalLinkTable.id, link.id),
          });
          if (scenario === "scope-loss") {
            expect(JSON.parse(completed!.metadata!)).toMatchObject({
              syncInitializationPending: true,
              syncFilterPaused: true,
            });
            return;
          }
          expect(JSON.parse(completed!.metadata!)).toMatchObject({
            syncInitializationPending: false,
            syncInitializedComment: true,
          });
        },
      );

    if (type === "gitlab")
      it.each(["status:to-do", "priority:low"])(
        "preserves the local %s scope label when the outbound baseline contains it",
        async (name) => {
          const f = await setup(type);
          await f.assign();
          const [root] = await db
            .insert(schema.labelTable)
            .values({
              workspaceId: f.workspace.id,
              name,
              color: "#123456",
            })
            .returning();
          await db.insert(schema.labelTable).values({
            workspaceId: f.workspace.id,
            taskId: f.task.id,
            name,
            color: root.color,
          });
          f.config.syncRules.outgoing.labels = [root.id];
          await db
            .update(schema.integrationTable)
            .set({ config: JSON.stringify(f.config) })
            .where(eq(schema.integrationTable.id, f.integration.id));
          await reconcileTaskSync(f.project.id, f.task.id);
          const link = (await db.query.externalLinkTable.findMany())[0]!;
          await updateExternalLink(link.id, {
            metadata: { syncResumeLabelBaseline: ["export", name] },
          });
          await handleGitlabIssueUpdated(
            {
              object_attributes: {
                iid: 12,
                title: f.task.title,
                description: "",
                state: "opened",
                url: "https://gitlab.example/team/repo/-/issues/12",
              },
              changes: {
                labels: {
                  previous: [{ title: "export" }, { title: name }],
                  current: [
                    { title: "export" },
                    { title: name },
                    { title: "new-remote" },
                  ],
                },
              },
              project: {
                name: "repo",
                path_with_namespace: "team/repo",
                web_url: "https://gitlab.example/team/repo",
              },
            },
            f.integration.id,
          );
          const assigned = await db.query.labelTable.findMany({
            where: eq(schema.labelTable.taskId, f.task.id),
          });
          expect(assigned.map((label) => label.name)).toContain(name);
          expect(await canSyncTask(f.task.id, f.integration.id)).toBe(true);
        },
      );

    it("does not dispatch a comment when its link is paused while the handler waits", async () => {
      const f = await setup(type);
      await f.assign();
      await reconcileTaskSync(f.project.id, f.task.id);
      mocks.comment.mockClear();
      const link = (await db.query.externalLinkTable.findMany())[0]!;
      const holder = await getDatabasePool().connect();
      await holder.query("begin");
      await holder.query(
        "select id from external_link where id = $1 for update",
        [link.id],
      );
      await holder.query(
        "update external_link set metadata = $2 where id = $1",
        [link.id, JSON.stringify({ syncFilterPaused: true })],
      );
      const comment = plugin.onTaskCommentCreated!(
        {
          taskId: f.task.id,
          projectId: f.project.id,
          userId: "test-user",
          comment: "Excluded comment",
        },
        {
          integrationId: f.integration.id,
          projectId: f.project.id,
          config: f.config,
        },
      );
      try {
        await vi.waitFor(async () => {
          const result = await db.execute<{ waiting: number }>(
            sql`select count(*)::int as waiting from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and pid <> pg_backend_pid()`,
          );
          expect(result.rows[0]!.waiting).toBeGreaterThan(0);
        });
      } finally {
        await holder.query("commit");
        holder.release();
        await comment;
      }
      expect(mocks.comment).not.toHaveBeenCalled();
    });

    it("releases dispatch locks while the provider handles a comment", async () => {
      const f = await setup(type);
      await f.assign();
      await reconcileTaskSync(f.project.id, f.task.id);
      let release!: () => void;
      const response = new Promise<void>((resolve) => {
        release = resolve;
      });
      mocks.comment.mockClear();
      mocks.comment.mockImplementationOnce(async () => {
        await response;
        return { id: 123 };
      });
      const comment = plugin.onTaskCommentCreated!(
        {
          taskId: f.task.id,
          projectId: f.project.id,
          userId: "test-user",
          comment: "Already dispatched",
        },
        {
          integrationId: f.integration.id,
          projectId: f.project.id,
          config: f.config,
        },
      );
      try {
        await vi.waitFor(() => expect(mocks.comment).toHaveBeenCalledOnce());
        await db
          .delete(schema.labelTable)
          .where(eq(schema.labelTable.taskId, f.task.id));
        await reconcileTaskSync(f.project.id, f.task.id);
        const link = (await db.query.externalLinkTable.findMany())[0]!;
        expect(JSON.parse(link.metadata!)).toMatchObject({
          syncFilterPaused: true,
        });
      } finally {
        release();
        await comment;
      }
    });

    it("records a successful outbound edit after its scope transaction fails", async () => {
      const f = await setup(type);
      await f.assign();
      await reconcileTaskSync(f.project.id, f.task.id);
      const link = (await db.query.externalLinkTable.findMany())[0]!;
      await db
        .update(schema.taskTable)
        .set({ title: "New title" })
        .where(eq(schema.taskTable.id, f.task.id));
      const write = vi.fn(async () => "local-time");
      let injected = false;
      const transaction = getDatabase().transaction.bind(getDatabase());
      vi.spyOn(getDatabase(), "transaction").mockImplementation(
        (apply, config) =>
          transaction(async (tx) => {
            const result = await apply(tx);
            if (!injected && write.mock.calls.length) {
              injected = true;
              throw new Error("Injected dispatch transaction failure");
            }
            return result;
          }, config),
      );
      const log = vi.spyOn(console, "error").mockImplementation(() => {});
      await syncLatestTaskValue(
        f.task.id,
        f.project.id,
        link,
        "title",
        "New title",
        write,
        undefined,
        { type, config: f.integration.config },
      );
      expect(injected).toBe(true);
      expect(write).toHaveBeenCalledOnce();
      const stored = await db.query.externalLinkTable.findFirst({
        where: eq(schema.externalLinkTable.id, link.id),
      });
      expect(JSON.parse(stored!.metadata!).lastSync.title).toMatchObject({
        source: "kaneo",
        value: "New title",
        outbound: [
          expect.objectContaining({ pending: false, updatedAt: "local-time" }),
        ],
      });
      expect(log).toHaveBeenCalledWith(
        "Issue write scope transaction failed after dispatch",
        { integrationId: f.integration.id, linkId: link.id },
      );
    });

    it.each(["open", "closed"] as const)(
      "adopts the configured %s workflow target when resuming",
      async (state) => {
        const f = await setup(type);
        await f.assign();
        await reconcileTaskSync(f.project.id, f.task.id);
        const link = (await db.query.externalLinkTable.findMany())[0]!;
        const [target] = await db
          .insert(schema.columnTable)
          .values({
            projectId: f.project.id,
            name: "Mapped",
            slug: "mapped",
            position: 99,
            isFinal: state === "closed",
          })
          .returning();
        await db.insert(schema.workflowRuleTable).values({
          projectId: f.project.id,
          integrationType: type,
          eventType: state === "closed" ? "issue_closed" : "issue_reopened",
          columnId: target.id,
        });
        if (state === "open")
          await db
            .update(schema.taskTable)
            .set({ status: f.columns.done.slug, columnId: f.columns.done.id })
            .where(eq(schema.taskTable.id, f.task.id));
        await updateExternalLink(link.id, {
          metadata: { syncFilterPaused: true },
        });
        mocks.read.mockResolvedValue({
          title: "Repository title",
          description: "Repository body",
          state,
          updatedAt: "remote-time",
          labels: [],
        });
        const review = await reviewSyncResume(
          f.project.id,
          type,
          link.id,
          f.workspace.id,
        );
        await resumeSync(
          f.project.id,
          type,
          link.id,
          review.token,
          "provider",
          f.workspace.id,
        );
        expect(
          await db.query.taskTable.findFirst({
            where: eq(schema.taskTable.id, f.task.id),
          }),
        ).toMatchObject({ status: "mapped", columnId: target.id });
        expect(mocks.write).not.toHaveBeenCalled();
        expect(await canSyncTask(f.task.id, f.integration.id)).toBe(true);
      },
    );

    it.each(["kaneo", "provider"] as const)(
      "preserves unreviewed fields after resuming with %s and accepts later label changes",
      async (source) => {
        const f = await setup(type);
        await f.assign();
        await reconcileTaskSync(f.project.id, f.task.id);
        const link = (await db.query.externalLinkTable.findMany())[0]!;
        await updateExternalLink(link.id, {
          metadata: { syncFilterPaused: true },
        });
        const [planned] = await db
          .insert(schema.columnTable)
          .values({
            projectId: f.project.id,
            name: "Planned",
            slug: "planned",
            position: -1,
            isFinal: false,
          })
          .returning();
        await db
          .update(schema.taskTable)
          .set({
            status: planned!.slug,
            columnId: planned!.id,
            priority: "urgent",
          })
          .where(eq(schema.taskTable.id, f.task.id));
        await db.insert(schema.labelTable).values({
          workspaceId: f.workspace.id,
          taskId: f.task.id,
          name: "local-only",
          color: "#123456",
        });
        const review = await reviewSyncResume(
          f.project.id,
          type,
          link.id,
          f.workspace.id,
        );
        await resumeSync(
          f.project.id,
          type,
          link.id,
          review.token,
          source,
          f.workspace.id,
        );
        const baseline = [
          "export",
          "priority:low",
          "status:to-do",
          "remote-old",
        ];
        async function receive(
          names: string[],
          previous: string[],
          added = "new-remote",
        ) {
          if (type === "github")
            await handleIssueLabeled({
              action: "labeled",
              installation: { id: 2 },
              repository: { id: 1, owner: { login: "team" }, name: "repo" },
              issue: { number: 12, labels: names },
              label: { name: added, color: "123456" },
            });
          else if (type === "gitea")
            await handleGiteaIssueLabeled(
              {
                action: "label_updated",
                repository: {
                  owner: { login: "team" },
                  name: "repo",
                  html_url: "https://git.example/team/repo",
                },
                issue: { number: 12, labels: names },
              },
              f.integration.id,
            );
          else
            await handleGitlabIssueUpdated(
              {
                object_attributes: {
                  iid: 12,
                  title: "Repository title",
                  description: "Repository body",
                  state: "opened",
                  url: "https://gitlab.example/team/repo/-/issues/12",
                },
                changes: {
                  labels: {
                    previous: previous.map((title) => ({ title })),
                    current: names.map((title) => ({ title })),
                  },
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
        const first = [...baseline, "new-remote"];
        await receive(first, baseline);
        expect(
          await db.query.taskTable.findFirst({
            where: eq(schema.taskTable.id, f.task.id),
          }),
        ).toMatchObject({
          priority: "urgent",
          status: "planned",
          columnId: planned!.id,
        });
        const labels = await db.query.labelTable.findMany({
          where: eq(schema.labelTable.taskId, f.task.id),
        });
        expect(labels.map((label) => label.name).sort()).toEqual([
          "export",
          "local-only",
          "new-remote",
        ]);
        const changed = [
          "export",
          "priority:high",
          "status:in-progress",
          "remote-old",
          "new-remote",
        ];
        await receive(changed, first, "priority:high");
        expect(
          await db.query.taskTable.findFirst({
            where: eq(schema.taskTable.id, f.task.id),
          }),
        ).toMatchObject({ priority: "high", status: "in-progress" });
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

it("lets an unrelated export proceed while two provider calls are slow", async () => {
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
  const [secondSlow] = await db
    .insert(schema.taskTable)
    .values({ projectId: f.project.id, number: 3, title: "Second slow task" })
    .returning();
  await db.insert(schema.labelTable).values({
    taskId: secondSlow!.id,
    workspaceId: f.workspace.id,
    name: "export",
    color: "#123456",
  });
  mocks.giteaCreate.mockReset();
  mocks.giteaCreate.mockImplementation(async (...args) => {
    if (args[2].title !== "Fast task") await gate;
    return {
      number: args[2].title === "Fast task" ? 13 : 12,
      html_url: "https://git.example/issues/12",
      title: args[2].title,
      state: "open",
    };
  });
  const slow = Promise.all([
    reconcileTaskSync(f.project.id, f.task.id),
    reconcileTaskSync(f.project.id, secondSlow!.id),
  ]);
  try {
    await vi.waitFor(() => expect(mocks.giteaCreate).toHaveBeenCalledTimes(2));
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
  await db.insert(schema.jobLeaseTable).values({
    name: key,
    owner: "other-test-instance",
    expiresAt: new Date(Date.now() + 60_000),
  });
  const competing = reconcileTaskSync(f.project.id, f.task.id);
  try {
    await new Promise((resolve) => setTimeout(resolve, 250));
    expect(mocks.giteaCreate).not.toHaveBeenCalled();
  } finally {
    await db
      .delete(schema.jobLeaseTable)
      .where(eq(schema.jobLeaseTable.name, key));
    await competing;
  }
  expect(mocks.giteaCreate).toHaveBeenCalledOnce();
  expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
});

it("refreshes scope once after a bulk run pauses multiple links", async () => {
  const f = await setup("gitea");
  const [other] = await db
    .insert(schema.taskTable)
    .values({
      projectId: f.project.id,
      title: "Other linked task",
      number: 2,
      status: "to-do",
    })
    .returning();
  await db.insert(schema.externalLinkTable).values(
    [f.task.id, other!.id].map((taskId, index) => ({
      taskId,
      integrationId: f.integration.id,
      resourceType: "issue",
      externalId: String(index + 1),
      url: `https://git.example/team/repo/issues/${index + 1}`,
    })),
  );
  const publish = vi.spyOn(events, "publishEvent");
  await reconcileProjectSync(f.project.id);
  expect(
    publish.mock.calls.filter(([name]) => name === "task.updated"),
  ).toHaveLength(2);
  expect(
    publish.mock.calls.filter(([name]) => name === "project.updated"),
  ).toEqual([["project.updated", { projectId: f.project.id }]]);
});

it("broadcasts only changed links and avoids task scans for unconfigured integrations", async () => {
  const f = await setup("gitea");
  const publish = vi.spyOn(events, "publishEvent");
  await reconcileProjectSync(f.project.id);
  expect(publish).not.toHaveBeenCalled();
  await f.assign();
  await reconcileTaskSync(f.project.id, f.task.id);
  expect(publish.mock.calls).toEqual([
    ["task.updated", { projectId: f.project.id, taskId: f.task.id }],
    ["project.updated", { projectId: f.project.id }],
  ]);
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

it("broadcasts deleted label availability even without changed links or an active integration", async () => {
  const f = await setup("gitea");
  const foreign = await setup("gitea");
  await db
    .update(schema.integrationTable)
    .set({ isActive: false })
    .where(eq(schema.integrationTable.id, f.integration.id));
  const publish = vi.spyOn(events, "publishEvent");
  await deleteLabel(f.config.syncRules.outgoing.labels[0]!, "test-user");
  expect(publish).toHaveBeenCalledWith("project.updated", {
    projectId: f.project.id,
  });
  expect(publish).not.toHaveBeenCalledWith("project.updated", {
    projectId: foreign.project.id,
  });
  const integration = await getSyncIntegration(f.project.id, "gitea");
  expect(
    (await previewSyncRules(integration, f.config.syncRules as SyncRules))
      .missingLabels,
  ).toEqual(f.config.syncRules.outgoing.labels);
});
