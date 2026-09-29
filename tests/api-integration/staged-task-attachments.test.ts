import { createTaskImageUploadUrl } from "../../apps/api/src/storage/s3";
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
        description: `/api/asset/${asset.id}`,
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
        description: `/api/asset/${asset.id}`,
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

it("leaves removed draft attachments private and eligible for expiry", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const upload = await stageTaskAssetUpload(project.id, user.id, {
    filename: "removed.png",
    contentType: "image/png",
    size: 12,
  });
  const asset = await finalizeStagedTaskAsset(project.id, user.id, {
    key: upload.key,
    filename: "removed.png",
    contentType: "image/png",
    size: 12,
  });
  await createTask({
    projectId: project.id,
    currentUserId: user.id,
    title: "without attachment",
    status: "to-do",
    description: "removed",
    draftAssetIds: [asset.id],
  });
  expect(
    await db.query.assetTable.findFirst({
      where: eq(schema.assetTable.id, asset.id),
    }),
  ).toMatchObject({ taskId: null, surface: "draft" });
});
it("finalizes the issued object after its project moves to another workspace", async () => {
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const destination = await createWorkspaceMember();
  const input = { filename: "moved.png", contentType: "image/png", size: 12 };
  const upload = await stageTaskAssetUpload(project.id, user.id, input);
  await db
    .update(schema.projectTable)
    .set({ workspaceId: destination.workspace.id })
    .where(eq(schema.projectTable.id, project.id));
  await db
    .update(schema.assetTable)
    .set({ workspaceId: destination.workspace.id })
    .where(eq(schema.assetTable.projectId, project.id));
  const asset = await finalizeStagedTaskAsset(project.id, user.id, {
    ...input,
    key: upload.key,
  });
  expect(
    await db.query.assetTable.findFirst({
      where: eq(schema.assetTable.id, asset.id),
    }),
  ).toMatchObject({
    workspaceId: destination.workspace.id,
    surface: "draft",
    objectKey: upload.key,
  });
});

it("records and claims assets in the current workspace after a move during presigning", async () => {
  const source = await createWorkspaceMember();
  const destination = await createWorkspaceMember();
  const { project } = await createProjectFixture({
    workspaceId: source.workspace.id,
  });
  vi.mocked(createTaskImageUploadUrl).mockImplementationOnce(async () => {
    await db
      .update(schema.projectTable)
      .set({ workspaceId: destination.workspace.id })
      .where(eq(schema.projectTable.id, project.id));
    return {
      key: "issued-in-source",
      uploadUrl: "https://example.test/upload",
      headers: {},
    };
  });
  const input = { filename: "image.png", contentType: "image/png", size: 12 };
  const upload = await stageTaskAssetUpload(project.id, source.user.id, input);
  expect(await db.query.assetTable.findFirst()).toMatchObject({
    workspaceId: destination.workspace.id,
  });
  const asset = await finalizeStagedTaskAsset(project.id, source.user.id, {
    ...input,
    key: upload.key,
  });
  await db
    .update(schema.assetTable)
    .set({ workspaceId: source.workspace.id })
    .where(eq(schema.assetTable.id, asset.id));
  await createTask({
    projectId: project.id,
    currentUserId: source.user.id,
    title: "submitted",
    status: "to-do",
    description: `/api/asset/${asset.id}`,
    draftAssetIds: [asset.id],
  });
  expect(await db.query.assetTable.findFirst()).toMatchObject({
    workspaceId: destination.workspace.id,
    surface: "description",
  });
});

it("drains an expired backlog across multiple bounded transactions", async () => {
  const { cleanupDraftUploads } =
    await import("../../apps/api/src/scheduler/draft-upload-cleanup");
  const { user, workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  await db.insert(schema.assetTable).values(
    Array.from({ length: 1001 }, (_, i) => ({
      workspaceId: workspace.id,
      projectId: project.id,
      surface: "draft-pending",
      objectKey: `backlog-${i}`,
      filename: "x.png",
      mimeType: "image/png",
      size: 1,
      createdBy: user.id,
      createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
    })),
  );
  await cleanupDraftUploads();
  expect(await db.query.assetTable.findMany()).toHaveLength(0);
  expect(await db.query.storageCleanupTable.findMany()).toHaveLength(1001);
});
