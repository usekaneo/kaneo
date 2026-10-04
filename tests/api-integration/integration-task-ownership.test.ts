import { eq, sql } from "drizzle-orm";
import * as eligibility from "../../apps/api/src/plugins/sync/eligibility";
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
  publish: vi.fn(async (_type: string, _data: unknown) => undefined),
  listIssues: vi.fn(),
  getIssue: vi.fn(),
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
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<typeof import("../../apps/api/src/events")>()),
  publishEvent: m.publish,
}));
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
  m.publish.mockReset().mockResolvedValue(undefined);
  m.listIssues.mockResolvedValue([remoteIssue]);
  m.getIssue.mockReset().mockResolvedValue(remoteIssue);
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
    "%s imports new issues from formatted configuration JSON",
    async (type) => {
      const f = await setup(type);
      await db
        .update(schema.projectTable)
        .set({ lastTaskNumber: 1 })
        .where(eq(schema.projectTable.id, f.project.id));
      await db
        .delete(schema.externalLinkTable)
        .where(eq(schema.externalLinkTable.id, f.link.id));
      await db
        .update(schema.integrationTable)
        .set({
          config: JSON.stringify(JSON.parse(f.integration.config), null, 2),
        })
        .where(eq(schema.integrationTable.id, f.integration.id));
      expect(
        await (type === "gitea" ? importGiteaIssues : importGitlabIssues)(
          f.project.id,
        ),
      ).toMatchObject({ imported: 1, skipped: 0 });
    },
  );

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

  it.each(["gitea", "gitlab"])(
    "%s import cannot revive a removed link after a task moves away and back",
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
        await moveTask({
          taskId: f.task.id,
          destinationProjectId: f.project.id,
          currentUserId: f.source.user.id,
        });
        return [];
      });
      const result = await (
        type === "gitea" ? importGiteaIssues : importGitlabIssues
      )(f.project.id);
      expect(result).toMatchObject({ updated: 0, skipped: 1 });
      await expectPrivateTask(f.task.id);
      expect(
        await db.query.externalLinkTable.findFirst({
          where: eq(schema.externalLinkTable.id, f.link.id),
        }),
      ).toBeUndefined();
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

it("preserves outbound history and unrelated fields across concurrent sync completions", async () => {
  const { updateExternalLink } =
    await import("../../apps/api/src/plugins/github/services/link-manager");
  const { isOutboundEcho } =
    await import("../../apps/api/src/plugins/github/utils/sync-echo");
  const { link } = await setup();
  await db
    .update(schema.externalLinkTable)
    .set({ metadata: JSON.stringify({ remoteMarker: "keep" }) })
    .where(eq(schema.externalLinkTable.id, link.id));
  await Promise.all(
    Array.from({ length: 12 }, (_, i) =>
      updateExternalLink(link.id, {
        outbound: {
          field: i % 2 ? "description" : "title",
          value: `edit-${i}`,
          updatedAt: `time-${i}`,
        },
      }),
    ),
  );
  const beforeStateWebhook = await db.query.externalLinkTable.findFirst({
    where: eq(schema.externalLinkTable.id, link.id),
  });
  const latestTitleStamp = JSON.parse(beforeStateWebhook!.metadata!).lastSync
    .title;
  // A state webhook can hold a metadata snapshot predating every outbound write.
  await updateExternalLink(link.id, {
    metadata: {
      remoteMarker: "keep",
      state: "closed",
      lastSync: {
        title: {
          source: "github",
          value: "remote",
          timestamp: "2000-01-01T00:00:00Z",
          outbound: [],
        },
      },
    },
  });
  const saved = await db.query.externalLinkTable.findFirst({
    where: eq(schema.externalLinkTable.id, link.id),
  });
  const metadata = JSON.parse(saved!.metadata!);
  expect(metadata.remoteMarker).toBe("keep");
  expect(metadata.lastSync.title).toEqual(latestTitleStamp);
  for (let i = 0; i < 12; i++)
    expect(
      isOutboundEcho(
        metadata.lastSync[i % 2 ? "description" : "title"],
        `edit-${i}`,
        `time-${i}`,
      ),
    ).toBe(true);
});

it("keeps outbound history committed during an inbound provider read", async () => {
  const { updateExternalLink } =
    await import("../../apps/api/src/plugins/github/services/link-manager");
  const { isOutboundEcho } =
    await import("../../apps/api/src/plugins/github/utils/sync-echo");
  const { link } = await setup();
  const { outboundStamp } =
    await import("../../apps/api/src/plugins/github/utils/sync-echo");
  await db
    .update(schema.externalLinkTable)
    .set({
      metadata: JSON.stringify({
        lastSync: {
          title: outboundStamp(
            outboundStamp(undefined, remoteIssue.title),
            "Latest local",
          ),
        },
      }),
    })
    .where(eq(schema.externalLinkTable.id, link.id));
  m.getIssue.mockImplementationOnce(async () => {
    await updateExternalLink(link.id, {
      outbound: {
        field: "title",
        value: "Local edit",
        updatedAt: "local-time",
      },
    });
    return remoteIssue;
  });
  await handleGiteaIssueEdited({
    action: "edited",
    repository,
    issue: remoteIssue,
    changes: { title: { from: "Old" } },
  });
  // The outbound metadata change invalidates the first provider confirmation.
  expect(m.getIssue).toHaveBeenCalledTimes(2);
  const saved = await db.query.externalLinkTable.findFirst({
    where: eq(schema.externalLinkTable.id, link.id),
  });
  expect(
    isOutboundEcho(
      JSON.parse(saved!.metadata!).lastSync.title,
      "Local edit",
      "local-time",
    ),
  ).toBe(true);
});
it.each(["edit", "labels", "comment"])(
  "ignores a stale %s webhook after its link is removed during a move and return",
  async (kind) => {
    const f = await setup();
    const transaction = getDatabase().transaction.bind(getDatabase());
    const intercepted = vi
      .spyOn(getDatabase(), "transaction")
      .mockImplementationOnce(async (apply, config) => {
        await moveTask({
          taskId: f.task.id,
          destinationProjectId: f.destination.id,
          userId: f.source.user.id,
        });
        await moveTask({
          taskId: f.task.id,
          destinationProjectId: f.project.id,
          userId: f.source.user.id,
        });
        return transaction(apply, config);
      });
    try {
      if (kind === "edit")
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
      if (kind === "labels")
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
      if (kind === "comment")
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
    } finally {
      intercepted.mockRestore();
    }
  },
);

it.each(["gitea", "gitlab"])(
  "announces committed %s reimport updates to task and resource caches",
  async (provider) => {
    const fixture = await setup(provider);
    m.publish.mockImplementation(async (type, data) => {
      if (
        !["task.updated", "task.labels_updated", "comment.updated"].includes(
          type,
        )
      )
        return;
      expect(data).toEqual({
        projectId: fixture.project.id,
        taskId: fixture.task.id,
      });
      expect(
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, fixture.task.id),
        }),
      ).toMatchObject({
        title: "Remote title",
        description: "Remote description",
      });
    });
    const result = await (
      provider === "gitea" ? importGiteaIssues : importGitlabIssues
    )(fixture.project.id);
    expect(result).toMatchObject({ imported: 0, updated: 1 });
    expect(m.publish.mock.calls.map(([type]) => type)).toEqual([
      "task.updated",
      "task.labels_updated",
      "comment.updated",
    ]);
  },
);

it("does not apply a webhook after its link is paused while waiting for the link lock", async () => {
  const f = await setup();
  let release!: () => void;
  let locked!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const acquired = new Promise<void>((resolve) => {
    locked = resolve;
  });
  const guard = vi.spyOn(eligibility, "canSyncTask");
  const pause = db.transaction(async (tx) => {
    await tx
      .select()
      .from(schema.externalLinkTable)
      .where(eq(schema.externalLinkTable.id, f.link.id))
      .for("update");
    await tx
      .update(schema.externalLinkTable)
      .set({ metadata: JSON.stringify({ syncFilterPaused: true }) })
      .where(eq(schema.externalLinkTable.id, f.link.id));
    locked();
    await gate;
  });
  await acquired;
  const webhook = handleGiteaIssueEdited(
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
  try {
    await vi.waitFor(async () => {
      const waiting = await db.execute<{ blocked: boolean }>(sql`
        select exists (
          select 1 from pg_stat_activity
          where datname = current_database()
            and wait_event_type = 'Lock'
            and query like '%external_link%'
        ) as blocked
      `);
      expect(waiting.rows[0]?.blocked).toBe(true);
    });
    expect(guard).not.toHaveBeenCalled();
    release();
    await pause;
    await webhook;
    expect(guard).toHaveBeenCalledOnce();
    await expectPrivateTask(f.task.id);
  } finally {
    release();
    await pause;
    await webhook;
    guard.mockRestore();
  }
});
