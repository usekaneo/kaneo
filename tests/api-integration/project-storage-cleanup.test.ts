import deleteTask from "../../apps/api/src/task/controllers/delete-task";
import bulkUpdateTasks from "../../apps/api/src/task/controllers/bulk-update-tasks";
import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
const m = vi.hoisted(() => ({ deleteS3Object: vi.fn() }));
vi.mock("../../apps/api/src/storage/s3", () => ({
  deleteS3Object: m.deleteS3Object,
}));
import db, { getDatabase, schema } from "../../apps/api/src/database";
import deleteProject from "../../apps/api/src/project/controllers/delete-project";
import { retryStorageCleanup } from "../../apps/api/src/storage/cleanup-queue";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

beforeEach(async () => {
  await resetTestDatabase();
  m.deleteS3Object.mockReset();
});
it("keeps attachment and background keys after cascading project deletion until storage recovers", async () => {
  const { workspace, user } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db
    .update(schema.projectTable)
    .set({ backgroundObjectKey: "synthetic-background" })
    .where(eq(schema.projectTable.id, project.id));
  await db.insert(schema.assetTable).values({
    projectId: project.id,
    workspaceId: workspace.id,
    objectKey: "synthetic-attachment",
    filename: "test.png",
    mimeType: "image/png",
    size: 1,
    createdBy: user.id,
  });
  m.deleteS3Object.mockRejectedValue(new Error("storage offline"));
  await deleteProject(project.id, workspace.id);
  expect(await db.select().from(schema.assetTable)).toHaveLength(0);
  expect(
    (await db.select().from(schema.storageCleanupTable))
      .map((row) => row.objectKey)
      .sort(),
  ).toEqual(["synthetic-attachment", "synthetic-background"]);
  expect(m.deleteS3Object).not.toHaveBeenCalled();
  await retryStorageCleanup();
  expect(await db.select().from(schema.storageCleanupTable)).toHaveLength(2);
  m.deleteS3Object.mockResolvedValue(undefined);
  expect(await retryStorageCleanup()).toEqual({ degraded: false });
  expect(await db.select().from(schema.storageCleanupTable)).toHaveLength(0);
});

it("captures storage keys when deleting the workspace through a parent cascade", async () => {
  const { workspace, user } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db
    .update(schema.projectTable)
    .set({ backgroundObjectKey: "parent-background" })
    .where(eq(schema.projectTable.id, project.id));
  await db.insert(schema.assetTable).values({
    projectId: project.id,
    workspaceId: workspace.id,
    objectKey: "parent-attachment",
    filename: "test.png",
    mimeType: "image/png",
    size: 1,
    createdBy: user.id,
  });
  await db
    .delete(schema.workspaceTable)
    .where(eq(schema.workspaceTable.id, workspace.id));
  expect(
    (await db.select().from(schema.storageCleanupTable))
      .map((row) => row.objectKey)
      .sort(),
  ).toEqual(["parent-attachment", "parent-background"]);
});

it("does not let a batch of failing objects starve later cleanup", async () => {
  await db.insert(schema.storageCleanupTable).values(
    Array.from({ length: 101 }, (_, i) => ({
      objectKey: `synthetic-${i}`,
      createdAt: new Date(Date.now() - (101 - i) * 1000),
    })),
  );
  m.deleteS3Object.mockImplementation(async (key: string) => {
    if (key !== "synthetic-100") throw new Error("permanent storage failure");
  });
  await retryStorageCleanup();
  await retryStorageCleanup();
  expect(m.deleteS3Object).toHaveBeenCalledWith("synthetic-100");
  expect(
    (await db.select().from(schema.storageCleanupTable)).map(
      (row) => row.objectKey,
    ),
  ).not.toContain("synthetic-100");
});

it("retries failed objects even with a continuous backlog of new keys", async () => {
  await db.insert(schema.storageCleanupTable).values({
    objectKey: "old-failure",
    createdAt: new Date(0),
    lastAttemptAt: new Date(1),
  });
  await db
    .insert(schema.storageCleanupTable)
    .values(Array.from({ length: 100 }, (_, i) => ({ objectKey: `new-${i}` })));
  m.deleteS3Object.mockRejectedValue(new Error("offline"));
  await retryStorageCleanup();
  expect(m.deleteS3Object).toHaveBeenCalledWith("old-failure");
});
it("does not delete an object referenced by a newly finalized live asset", async () => {
  const { workspace, user } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db
    .insert(schema.storageCleanupTable)
    .values({ objectKey: "reused-live-key" });
  await db.insert(schema.assetTable).values({
    projectId: project.id,
    workspaceId: workspace.id,
    objectKey: "reused-live-key",
    filename: "test.png",
    mimeType: "image/png",
    size: 1,
    createdBy: user.id,
  });
  await retryStorageCleanup();
  expect(m.deleteS3Object).not.toHaveBeenCalled();
  expect(await db.select().from(schema.assetTable)).toHaveLength(1);
});

it.each(["single", "bulk"])(
  "recovers queued attachments after %s task deletion",
  async (mode) => {
    const { workspace, user } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "delete attachment",
        status: "to-do",
      })
      .returning();
    await db.insert(schema.assetTable).values({
      taskId: task.id,
      projectId: project.id,
      workspaceId: workspace.id,
      objectKey: "task-attachment",
      filename: "test.png",
      mimeType: "image/png",
      size: 1,
      createdBy: user.id,
    });
    m.deleteS3Object.mockRejectedValue(new Error("offline"));
    if (mode === "single") await deleteTask(task.id, user.id);
    else
      await bulkUpdateTasks({
        taskIds: [task.id],
        operation: "delete",
        userId: user.id,
      });
    expect(m.deleteS3Object).not.toHaveBeenCalled();
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toBeUndefined();
    await retryStorageCleanup();
    expect(await db.select().from(schema.storageCleanupTable)).toHaveLength(1);
    m.deleteS3Object.mockResolvedValue(undefined);
    await retryStorageCleanup();
    expect(await db.select().from(schema.storageCleanupTable)).toHaveLength(0);
  },
);

it("gives new objects a turn despite a full batch of permanent retries", async () => {
  await db.insert(schema.storageCleanupTable).values(
    Array.from({ length: 100 }, (_, index) => ({
      objectKey: `failure-${index}`,
      createdAt: new Date(0),
      lastAttemptAt: new Date(1),
    })),
  );
  await db
    .insert(schema.storageCleanupTable)
    .values({ objectKey: "new-object", createdAt: new Date(2) });
  m.deleteS3Object.mockImplementation(async (key) => {
    if (key !== "new-object") throw new Error("offline");
  });
  await retryStorageCleanup();
  expect(m.deleteS3Object).toHaveBeenCalledWith("new-object");
  expect(
    await db.query.storageCleanupTable.findFirst({
      where: eq(schema.storageCleanupTable.objectKey, "new-object"),
    }),
  ).toBeUndefined();
});

it("queues more than the PostgreSQL parameter limit without rolling back", async () => {
  const { queueStorageCleanup } =
    await import("../../apps/api/src/storage/cleanup-queue");
  await db.transaction((tx) =>
    queueStorageCleanup(
      tx,
      Array.from({ length: 66_000 }, (_, i) => `large-project-${i}`),
    ),
  );
  const { sql } = await import("drizzle-orm");
  const count = await db.execute(
    sql`select count(*)::integer as total from ${schema.storageCleanupTable}`,
  );
  expect(count.rows[0].total).toBe(66_000);
});

it("keeps the pool available and protects objects during slow verification", async () => {
  const { withVerifiedStorageObject } =
    await import("../../apps/api/src/storage/cleanup-queue");
  const { sql } = await import("drizzle-orm");
  let finish!: () => void;
  const wait = new Promise<void>((resolve) => {
    finish = resolve;
  });
  let started = 0;
  let allStarted!: () => void;
  const ready = new Promise<void>((resolve) => {
    allStarted = resolve;
  });
  const pending = Array.from({ length: 10 }, (_, i) =>
    withVerifiedStorageObject(
      `slow-${i}`,
      async () => {
        if (++started === 10) allStarted();
        await wait;
        return i;
      },
      async (_tx, value) => value,
    ),
  );
  try {
    await ready;
    expect((await db.execute(sql`select 1 as healthy`)).rows[0].healthy).toBe(
      1,
    );
    await db.insert(schema.storageCleanupTable).values({ objectKey: "slow-0" });
    await retryStorageCleanup();
    expect(m.deleteS3Object).not.toHaveBeenCalled();
    expect(await db.query.storageCleanupTable.findMany()).toHaveLength(1);
  } finally {
    finish();
    await Promise.all(pending);
  }
  expect(await db.query.jobLeaseTable.findMany()).toHaveLength(0);
});

it("declines to finalize after a verification lease expires", async () => {
  const { withVerifiedStorageObject } =
    await import("../../apps/api/src/storage/cleanup-queue");
  const apply = vi.fn();
  await expect(
    withVerifiedStorageObject(
      "expired",
      async () => {
        await db
          .update(schema.jobLeaseTable)
          .set({ expiresAt: new Date(0) })
          .where(eq(schema.jobLeaseTable.name, "storage-verification:expired"));
      },
      apply,
    ),
  ).rejects.toThrow("expired");
  expect(apply).not.toHaveBeenCalled();
  expect(await db.query.jobLeaseTable.findMany()).toHaveLength(0);
});

it.each(["single", "bulk"])(
  "rejects %s deletion when a task moves after its authorized read",
  async (mode) => {
    const { workspace, user } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const foreign = await createWorkspaceMember();
    const destination = await createProjectFixture({
      workspaceId: foreign.workspace.id,
    });
    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        title: "Moved attachment",
        status: "to-do",
      })
      .returning();
    await db.insert(schema.assetTable).values({
      taskId: task.id,
      projectId: project.id,
      workspaceId: workspace.id,
      objectKey: "moved-attachment",
      filename: "test.png",
      mimeType: "image/png",
      size: 1,
      createdBy: user.id,
    });
    const transaction = db.transaction.bind(db);
    vi.spyOn(getDatabase(), "transaction").mockImplementationOnce(
      async (apply, config) => {
        await db
          .update(schema.taskTable)
          .set({ projectId: destination.project.id })
          .where(eq(schema.taskTable.id, task.id));
        await db
          .update(schema.assetTable)
          .set({
            projectId: destination.project.id,
            workspaceId: foreign.workspace.id,
          })
          .where(eq(schema.assetTable.taskId, task.id));
        return transaction(apply, config);
      },
    );
    const deletion =
      mode === "single"
        ? deleteTask(task.id, user.id)
        : bulkUpdateTasks({
            taskIds: [task.id],
            operation: "delete",
            userId: user.id,
          });
    await expect(deletion).rejects.toMatchObject({ status: 409 });
    expect(
      await db
        .select()
        .from(schema.taskTable)
        .where(eq(schema.taskTable.id, task.id)),
    ).toHaveLength(1);
    expect(
      await db
        .select()
        .from(schema.assetTable)
        .where(eq(schema.assetTable.taskId, task.id)),
    ).toHaveLength(1);
    expect(await db.select().from(schema.storageCleanupTable)).toHaveLength(0);
    expect(m.deleteS3Object).not.toHaveBeenCalled();
  },
);
