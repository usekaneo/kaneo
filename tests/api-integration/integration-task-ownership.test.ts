import { eq } from "drizzle-orm";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vite-plus/test";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import { importGiteaIssues } from "../../apps/api/src/gitea-integration/controllers/import-gitea-issues";
import { importGitlabIssues } from "../../apps/api/src/gitlab-integration/controllers/import-gitlab-issues";
import { handleGiteaIssueEdited } from "../../apps/api/src/plugins/gitea/webhooks/issue-edited";
import { handleGiteaIssueLabeled } from "../../apps/api/src/plugins/gitea/webhooks/issue-labeled";
import { handleGiteaIssueCommentCreated } from "../../apps/api/src/plugins/gitea/webhooks/issue-comment-created";
import { withIntegrationTask } from "../../apps/api/src/plugins/github/services/integration-task-scope";
import moveTask from "../../apps/api/src/task/controllers/move-task";
import moveProject from "../../apps/api/src/project/controllers/move-project";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const m = vi.hoisted(() => ({
  listIssues: vi.fn(),
  listIssueComments: vi.fn(async () => []),
  listIssueNotes: vi.fn(async () => []),
  listPulls: vi.fn(async () => []),
  listMergeRequests: vi.fn(async () => []),
}));
vi.mock(
  "../../apps/api/src/plugins/gitea/utils/gitea-api",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/gitea/utils/gitea-api")
    >()),
    createGiteaClient: () => m,
  }),
);
vi.mock(
  "../../apps/api/src/plugins/gitlab/utils/gitlab-api",
  async (original) => ({
    ...(await original<
      typeof import("../../apps/api/src/plugins/gitlab/utils/gitlab-api")
    >()),
    createGitlabClient: () => m,
  }),
);
const remoteIssue = {
  number: 1,
  iid: 1,
  title: "Remote title",
  body: "Remote description",
  description: "Remote description",
  html_url: "https://gitea.example/owner/repo/issues/1",
  web_url: "https://gitlab.example/group/repo/-/issues/1",
  state: "open",
  labels: [],
};
const repository = {
  owner: { login: "owner" },
  name: "repo",
  html_url: "https://gitea.example/owner/repo",
};
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
  m.listIssues.mockResolvedValue([remoteIssue]);
  m.listIssueComments.mockResolvedValue([]);
  m.listIssueNotes.mockResolvedValue([]);
});
async function setup(type = "gitea") {
  const source = await createWorkspaceMember({ role: "owner" });
  const privateWorkspace = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({
    workspaceId: source.workspace.id,
  });
  const { project: destination } = await createProjectFixture({
    workspaceId: source.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Private title",
      description: "Private description",
      number: 1,
    })
    .returning();
  const [integration] = await db
    .insert(schema.integrationTable)
    .values({
      projectId: project.id,
      type,
      config: JSON.stringify({
        baseUrl: `https://${type}.example`,
        accessToken: "fake-test-token",
        repositoryOwner: "owner",
        repositoryName: "repo",
        projectPath: "group/repo",
      }),
    })
    .returning();
  const [link] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: "1",
      url: remoteIssue.html_url,
    })
    .returning();
  return {
    source,
    privateWorkspace,
    project,
    destination,
    task,
    integration,
    link,
  };
}
async function moveWithoutCleanup(fixture: Awaited<ReturnType<typeof setup>>) {
  // Reproduce links left by earlier releases, even after their new project
  // has moved into a private workspace.
  await db
    .update(schema.taskTable)
    .set({ projectId: fixture.destination.id })
    .where(eq(schema.taskTable.id, fixture.task.id));
  await db
    .update(schema.projectTable)
    .set({ workspaceId: fixture.privateWorkspace.workspace.id })
    .where(eq(schema.projectTable.id, fixture.destination.id));
}
async function expectPrivateTask(taskId: string) {
  expect(
    await db.query.taskTable.findFirst({
      where: eq(schema.taskTable.id, taskId),
    }),
  ).toMatchObject({
    title: "Private title",
    description: "Private description",
  });
  expect(
    await db.query.labelTable.findMany({
      where: eq(schema.labelTable.taskId, taskId),
    }),
  ).toEqual([]);
  expect(
    await db.query.activityTable.findMany({
      where: eq(schema.activityTable.taskId, taskId),
    }),
  ).toEqual([]);
}
describe("integration task ownership", () => {
  it.each(["gitea", "gitlab"])(
    "%s import cannot modify a moved task through an old link",
    async (type) => {
      const fixture = await setup(type);
      await moveWithoutCleanup(fixture);
      const result = await (
        type === "gitea" ? importGiteaIssues : importGitlabIssues
      )(fixture.project.id);
      expect(result.updated).toBe(0);
      await expectPrivateTask(fixture.task.id);
    },
  );
  it.each(["gitea", "gitlab"])(
    "%s comment fetching leaves task moves unlocked and rechecks scope afterwards",
    async (type) => {
      const f = await setup(type);
      const fetchComments =
        type === "gitea" ? m.listIssueComments : m.listIssueNotes;
      fetchComments.mockImplementationOnce(async () => {
        await moveTask({
          taskId: f.task.id,
          destinationProjectId: f.destination.id,
          currentUserId: f.source.user.id,
        });
        return [];
      });
      const result = await (
        type === "gitea" ? importGiteaIssues : importGitlabIssues
      )(f.project.id);
      expect(result.updated).toBe(0);
      await expectPrivateTask(f.task.id);
      expect(
        (
          await db.query.taskTable.findFirst({
            where: eq(schema.taskTable.id, f.task.id),
          })
        )?.projectId,
      ).toBe(f.destination.id);
    },
  );

  it("gitea edits, labels and comments cannot follow stale links", async () => {
    const f = await setup();
    await moveWithoutCleanup(f);
    await handleGiteaIssueEdited(
      {
        action: "edited",
        issue: remoteIssue,
        repository,
        changes: {
          title: { from: "Private title" },
          body: { from: "Private description" },
        },
      },
      f.integration.id,
    );
    await handleGiteaIssueLabeled(
      {
        action: "labeled",
        issue: {
          number: 1,
          labels: [{ name: "priority:high" }, { name: "bug" }],
        },
        label: { name: "bug", color: "ff0000" },
        repository,
      },
      f.integration.id,
    );
    await handleGiteaIssueCommentCreated(
      {
        action: "created",
        issue: { number: 1 },
        repository,
        comment: {
          id: 4,
          body: "Wrong workspace",
          html_url: `${remoteIssue.html_url}#comment-4`,
          user: { login: "author", avatar_url: "" },
          created_at: new Date().toISOString(),
        },
      },
      f.integration.id,
    );
    await expectPrivateTask(f.task.id);
  });
  it("moving a task removes links to its previous project's integration atomically", async () => {
    const f = await setup();
    const [manual] = await db
      .insert(schema.externalLinkTable)
      .values({
        taskId: f.task.id,
        resourceType: "url",
        integrationId: null,
        url: "https://example.test/manual",
        externalId: "manual",
      })
      .returning();
    await moveTask({
      taskId: f.task.id,
      destinationProjectId: f.destination.id,
      currentUserId: f.source.user.id,
    });
    expect(
      await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      }),
    ).toEqual([manual]);
  });
  it("moving a project removes legacy links owned by another project", async () => {
    const f = await setup();
    await db
      .update(schema.taskTable)
      .set({ projectId: f.destination.id })
      .where(eq(schema.taskTable.id, f.task.id));
    await moveProject(
      f.destination.id,
      f.source.workspace.id,
      f.privateWorkspace.workspace.id,
      f.source.user.id,
    );
    expect(
      await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      }),
    ).toEqual([]);
  });
  it("a concurrent task move waits for scoped integration writes to commit", async () => {
    const f = await setup();
    let release!: () => void;
    let started!: () => void;
    const barrier = new Promise<void>((resolve) => {
      release = resolve;
    });
    const ready = new Promise<void>((resolve) => {
      started = resolve;
    });
    const sync = withIntegrationTask(
      f.task.id,
      { ...f.integration, project: f.project },
      async (tx) => {
        started();
        await barrier;
        await tx
          .update(schema.taskTable)
          .set({ title: "Synced before moving" })
          .where(eq(schema.taskTable.id, f.task.id));
      },
    );
    await ready;
    let moved = false;
    const move = moveTask({
      taskId: f.task.id,
      destinationProjectId: f.destination.id,
      currentUserId: f.source.user.id,
    }).then(() => {
      moved = true;
    });
    try {
      await new Promise((resolve) => setTimeout(resolve, 30));
      expect(moved).toBe(false);
    } finally {
      release();
    }
    await Promise.all([sync, move]);
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, f.task.id),
      }),
    ).toMatchObject({
      projectId: f.destination.id,
      title: "Synced before moving",
    });
    expect(
      await db.query.externalLinkTable.findMany({
        where: eq(schema.externalLinkTable.taskId, f.task.id),
      }),
    ).toEqual([]);
  });
});

afterEach(() => vi.restoreAllMocks());
it("reports a concurrent move as a conflict without deleting links", async () => {
  const f = await setup();
  const transaction = db.transaction.bind(db);
  vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
    async (apply, config) => {
      await db
        .update(schema.taskTable)
        .set({ projectId: f.destination.id })
        .where(eq(schema.taskTable.id, f.task.id));
      return transaction(apply, config);
    },
  );
  await expect(
    moveTask({
      taskId: f.task.id,
      destinationProjectId: f.destination.id,
      userId: f.source.user.id,
    }),
  ).rejects.toMatchObject({ status: 409 });
  expect(await db.query.externalLinkTable.findMany()).toHaveLength(1);
});

it("preserves legacy links belonging to the destination integration when moving back", async () => {
  const f = await setup();
  const [destinationIntegration] = await db
    .insert(schema.integrationTable)
    .values({ projectId: f.destination.id, type: "gitea", config: "{}" })
    .returning();
  const [compatible] = await db
    .insert(schema.externalLinkTable)
    .values({
      taskId: f.task.id,
      integrationId: destinationIntegration.id,
      resourceType: "issue",
      externalId: "legacy",
      url: "https://gitea.example/legacy",
    })
    .returning();
  await moveTask({
    taskId: f.task.id,
    destinationProjectId: f.destination.id,
    userId: f.source.user.id,
  });
  expect(await db.query.externalLinkTable.findMany()).toEqual([compatible]);
});
