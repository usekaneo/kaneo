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
