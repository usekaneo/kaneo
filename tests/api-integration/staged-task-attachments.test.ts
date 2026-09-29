import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import createTask from "../../apps/api/src/task/controllers/create-task";
import {
  stageTaskAssetUpload,
  finalizeStagedTaskAsset,
} from "../../apps/api/src/task/controllers/stage-task-asset";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
const publish = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../apps/api/src/events", () => ({ publishEvent: publish }));
vi.mock("../../apps/api/src/storage/s3", () => ({
  validateTaskAssetUploadInput: vi.fn(),
  createTaskImageUploadUrl: vi.fn(async (context: { taskId: string }) => ({
    key: `${context.taskId}/test.png`,
    uploadUrl: "https://example.test/upload",
    headers: {},
  })),
  assertTaskImageKeyMatchesContext: vi.fn(
    (key: string, context: { taskId: string }) =>
      key.startsWith(`${context.taskId}/`),
  ),
  verifyTaskAssetUpload: vi.fn(async () => ({
    size: 12,
    contentType: "image/png",
  })),
  isImageContentType: () => true,
  InvalidUploadedAssetError: class extends Error {},
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});
describe("staged task attachments", () => {
  it("creates no task or integration event until explicit submission", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const input = { filename: "image.png", contentType: "image/png", size: 12 };
    const upload = await stageTaskAssetUpload(project.id, user.id, input);
    expect(await db.query.taskTable.findMany()).toHaveLength(0);
    expect(await db.query.assetTable.findMany()).toEqual([
      expect.objectContaining({
        taskId: null,
        surface: "draft-pending",
        objectKey: upload.key,
      }),
    ]);
    const asset = await finalizeStagedTaskAsset(project.id, user.id, {
      ...input,
      key: upload.key,
    });
    expect(publish).not.toHaveBeenCalled();
    const task = await createTask({
      projectId: project.id,
      currentUserId: user.id,
      title: "submitted",
      status: "to-do",
      description: `/api/asset/${asset.id}`,
      draftAssetIds: [asset.id],
    });
    expect(
      await db.query.assetTable.findFirst({
        where: eq(schema.assetTable.id, asset.id),
      }),
    ).toMatchObject({ taskId: task.id, surface: "description" });
    expect(publish).toHaveBeenCalledTimes(1);
    expect(publish).toHaveBeenCalledWith(
      "task.created",
      expect.objectContaining({ taskId: task.id }),
    );
  });
  it("cannot claim an upload belonging to another creator or project", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const outsider = await createWorkspaceMember();
    const [asset] = await db
      .insert(schema.assetTable)
      .values({
        workspaceId: workspace.id,
        projectId: project.id,
        objectKey: "other-owner",
        filename: "x",
        mimeType: "image/png",
        size: 12,
        surface: "draft",
        createdBy: outsider.user.id,
      })
      .returning();
    await expect(
      createTask({
        projectId: project.id,
        currentUserId: user.id,
        title: "bad",
        status: "to-do",
        draftAssetIds: [asset.id],
      }),
    ).rejects.toThrow("staged uploads");
    expect(await db.query.taskTable.findMany()).toHaveLength(0);
    expect(publish).not.toHaveBeenCalled();
  });
  it("cannot submit an upload before finalization", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    await stageTaskAssetUpload(project.id, user.id, {
      filename: "image.png",
      contentType: "image/png",
      size: 12,
    });
    const [asset] = await db.query.assetTable.findMany();
    await expect(
      createTask({
        projectId: project.id,
        currentUserId: user.id,
        title: "bad",
        status: "to-do",
        draftAssetIds: [asset.id],
      }),
    ).rejects.toThrow("staged uploads");
    expect(await db.query.taskTable.findMany()).toHaveLength(0);
  });
});

it("expires abandoned pending and finalized uploads without deleting published assets", async () => {
  const { cleanupDraftUploads } =
    await import("../../apps/api/src/scheduler/draft-upload-cleanup");
  const { workspace, user } = await createWorkspaceMember({ role: "owner" });
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db.insert(schema.assetTable).values(
    ["draft", "draft-pending", "description"].map((surface) => ({
      workspaceId: workspace.id,
      projectId: project.id,
      surface,
      objectKey: `synthetic-expiry-${surface}`,
      filename: "test.png",
      mimeType: "image/png",
      size: 1,
      createdBy: user.id,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })),
  );
  await cleanupDraftUploads();
  expect(
    (await db.select().from(schema.assetTable)).map((asset) => asset.surface),
  ).toEqual(["description"]);
  expect(
    (await db.select().from(schema.storageCleanupTable))
      .map((item) => item.objectKey)
      .sort(),
  ).toEqual(["synthetic-expiry-draft", "synthetic-expiry-draft-pending"]);
});
