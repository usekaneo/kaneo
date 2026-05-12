import { eq, inArray } from "drizzle-orm";
import db from "../database";
import { assetTable } from "../database/schema";
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

export async function deleteOrphanedAssets(
  oldContent: string | null | undefined,
  newContent: string | null | undefined,
): Promise<void> {
  const oldIds = extractAssetIds(oldContent);
  const newIds = extractAssetIds(newContent);

  const removedIds = [...oldIds].filter((id) => !newIds.has(id));
  if (removedIds.length === 0) return;

  const assets = await db
    .select({ id: assetTable.id, objectKey: assetTable.objectKey })
    .from(assetTable)
    .where(inArray(assetTable.id, removedIds));

  for (const asset of assets) {
    try {
      await deleteS3Object(asset.objectKey);
    } catch {
      // S3 deletion is best-effort; the DB record is still removed below
    }
  }

  if (assets.length > 0) {
    await db.delete(assetTable).where(
      inArray(
        assetTable.id,
        assets.map((a) => a.id),
      ),
    );
  }
}

export async function deleteAllTaskAssets(taskId: string): Promise<void> {
  const assets = await db
    .select({ id: assetTable.id, objectKey: assetTable.objectKey })
    .from(assetTable)
    .where(eq(assetTable.taskId, taskId));

  for (const asset of assets) {
    try {
      await deleteS3Object(asset.objectKey);
    } catch {
      // best-effort
    }
  }

  // DB rows cascade-delete with the task, so no explicit delete needed here
}
