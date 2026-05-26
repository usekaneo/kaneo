import { and, eq, inArray, like } from "drizzle-orm";
import db from "../database";
import {
  activityTable,
  assetTable,
  commentTable,
  taskTable,
} from "../database/schema";
import { deleteS3Object } from "./s3";

const ASSET_URL_PATTERN = /\/api\/asset\/([a-z0-9]+)/gi;

export function extractAssetIds(
  content: string | null | undefined,
): Set<string> {
  const ids = new Set<string>();
  if (!content) return ids;

  ASSET_URL_PATTERN.lastIndex = 0;
  for (
    let match = ASSET_URL_PATTERN.exec(content);
    match !== null;
    match = ASSET_URL_PATTERN.exec(content)
  ) {
    if (match[1]) ids.add(match[1]);
  }

  return ids;
}

export function contentReferencesAsset(
  content: string | null | undefined,
  assetId: string,
): boolean {
  return extractAssetIds(content).has(assetId);
}

export interface AssetCleanupScope {
  taskId: string;
}

/**
 * Check whether an asset ID is still referenced in any content belonging to
 * the same task (description, comments, or activity comments).
 */
async function isAssetReferencedElsewhere(
  assetId: string,
  taskId: string,
): Promise<boolean> {
  const pattern = `%/api/asset/${assetId}%`;

  const [taskRef] = await db
    .select({ description: taskTable.description })
    .from(taskTable)
    .where(and(eq(taskTable.id, taskId), like(taskTable.description, pattern)))
    .limit(1);

  if (contentReferencesAsset(taskRef?.description, assetId)) return true;

  const commentRefs = await db
    .select({ content: commentTable.content })
    .from(commentTable)
    .where(
      and(eq(commentTable.taskId, taskId), like(commentTable.content, pattern)),
    );

  if (commentRefs.some((ref) => contentReferencesAsset(ref.content, assetId))) {
    return true;
  }

  const activityRefs = await db
    .select({ content: activityTable.content })
    .from(activityTable)
    .where(
      and(
        eq(activityTable.taskId, taskId),
        like(activityTable.content, pattern),
      ),
    );

  if (
    activityRefs.some((ref) => contentReferencesAsset(ref.content, assetId))
  ) {
    return true;
  }

  return false;
}

export async function deleteOrphanedAssets(
  oldContent: string | null | undefined,
  newContent: string | null | undefined,
  scope: AssetCleanupScope,
): Promise<void> {
  const oldIds = extractAssetIds(oldContent);
  const newIds = extractAssetIds(newContent);

  const removedIds = [...oldIds].filter((id) => !newIds.has(id));
  if (removedIds.length === 0) return;

  const assets = await db
    .select({ id: assetTable.id, objectKey: assetTable.objectKey })
    .from(assetTable)
    .where(
      and(
        inArray(assetTable.id, removedIds),
        eq(assetTable.taskId, scope.taskId),
      ),
    );

  const assetsToDelete: typeof assets = [];
  for (const asset of assets) {
    const stillReferenced = await isAssetReferencedElsewhere(
      asset.id,
      scope.taskId,
    );
    if (!stillReferenced) {
      assetsToDelete.push(asset);
    }
  }

  if (assetsToDelete.length === 0) return;

  const deleteResults = await deleteS3Keys(
    assetsToDelete.map((asset) => asset.objectKey),
  );

  const deletedAssetIds = assetsToDelete
    .filter((_, index) => deleteResults[index]?.status === "fulfilled")
    .map((asset) => asset.id);

  if (deletedAssetIds.length === 0) return;

  await db.delete(assetTable).where(inArray(assetTable.id, deletedAssetIds));
}

export async function getTaskAssetKeys(taskId: string): Promise<string[]> {
  const assets = await db
    .select({ objectKey: assetTable.objectKey })
    .from(assetTable)
    .where(eq(assetTable.taskId, taskId));

  return assets.map((a) => a.objectKey);
}

export async function deleteS3Keys(
  keys: string[],
): Promise<PromiseSettledResult<void>[]> {
  const deleteResults = await Promise.allSettled(
    keys.map((key) => deleteS3Object(key)),
  );

  const failedDeletions = keys
    .map((key, index) => ({ key, result: deleteResults[index] }))
    .filter(
      (
        deletion,
      ): deletion is {
        key: string;
        result: PromiseRejectedResult;
      } => deletion.result?.status === "rejected",
    );

  if (failedDeletions.length > 0) {
    console.error(
      "Failed to delete S3 objects",
      failedDeletions.map(({ key, result }) => ({
        key,
        reason: result.reason,
      })),
    );
  }

  return deleteResults;
}
