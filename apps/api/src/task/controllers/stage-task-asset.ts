import { and, eq, inArray, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { assetTable, projectTable } from "../../database/schema";
import {
  createTaskImageUploadUrl,
  InvalidUploadedAssetError,
  isImageContentType,
  validateTaskAssetUploadInput,
  verifyTaskAssetUpload,
} from "../../storage/s3";

type Upload = { filename: string; contentType: string; size: number };
async function uploadContext(projectId: string, userId: string) {
  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });
  if (!project) throw new HTTPException(404, { message: "Project not found" });
  return {
    workspaceId: project.workspaceId,
    projectId,
    taskId: `draft-${userId}`,
    surface: "description" as const,
  };
}
function validate(input: Upload) {
  try {
    validateTaskAssetUploadInput(input.contentType, input.size);
  } catch (error) {
    throw new HTTPException(400, {
      message: error instanceof Error ? error.message : "Invalid upload",
    });
  }
}
export async function stageTaskAssetUpload(
  projectId: string,
  userId: string,
  input: Upload,
) {
  validate(input);
  const context = await uploadContext(projectId, userId);
  let upload: Awaited<ReturnType<typeof createTaskImageUploadUrl>>;
  try {
    upload = await createTaskImageUploadUrl({ ...context, ...input });
  } catch {
    throw new HTTPException(503, {
      message: "Image uploads are not configured",
    });
  }
  await db.transaction(async (tx) => {
    const [currentProject] = await tx
      .select({ workspaceId: projectTable.workspaceId })
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .for("share");
    if (!currentProject)
      throw new HTTPException(404, { message: "Project not found" });
    await tx.insert(assetTable).values({
      workspaceId: currentProject.workspaceId,
      projectId,
      taskId: null,
      objectKey: upload.key,
      filename: input.filename,
      mimeType: input.contentType,
      size: input.size,
      kind: isImageContentType(input.contentType) ? "image" : "attachment",
      surface: "draft-pending",
      createdBy: userId,
    });
  });
  return upload;
}
export async function finalizeStagedTaskAsset(
  projectId: string,
  userId: string,
  input: Upload & { key: string },
) {
  validate(input);
  await uploadContext(projectId, userId);
  const key = input.key.trim();
  // The persisted key is the issuance record. Project moves update authorization
  // metadata, but the object remains at its originally issued storage key.
  const existing = await db.query.assetTable.findFirst({
    where: eq(assetTable.objectKey, key),
  });
  if (
    !existing ||
    !["draft", "draft-pending"].includes(existing.surface) ||
    existing.createdBy !== userId ||
    existing.projectId !== projectId ||
    existing.taskId !== null
  )
    throw new HTTPException(409, {
      message: "Upload is unavailable or already attached",
    });
  let uploaded: Awaited<ReturnType<typeof verifyTaskAssetUpload>>;
  try {
    uploaded = await verifyTaskAssetUpload(key, input);
  } catch (error) {
    throw new HTTPException(
      error instanceof InvalidUploadedAssetError ? 400 : 503,
      {
        message:
          error instanceof Error ? error.message : "Unable to verify upload",
      },
    );
  }
  const [asset] = await db
    .update(assetTable)
    .set({
      mimeType: uploaded.contentType,
      size: uploaded.size,
      kind: isImageContentType(uploaded.contentType) ? "image" : "attachment",
      surface: "draft",
    })
    .where(
      and(
        eq(assetTable.id, existing.id),
        isNull(assetTable.taskId),
        inArray(assetTable.surface, ["draft", "draft-pending"]),
      ),
    )
    .returning({ id: assetTable.id });
  if (!asset)
    throw new HTTPException(409, { message: "Upload is already attached" });
  return asset;
}
