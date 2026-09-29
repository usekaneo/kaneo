import deleteTask from "../../apps/api/src/task/controllers/delete-task";
import bulkUpdateTasks from "../../apps/api/src/task/controllers/bulk-update-tasks";
import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
const m = vi.hoisted(() => ({ deleteS3Object: vi.fn() }));
vi.mock("../../apps/api/src/storage/s3", () => ({
  deleteS3Object: m.deleteS3Object,
}));
import db, { schema } from "../../apps/api/src/database";
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
