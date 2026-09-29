import { and, inArray, isNull, lt } from "drizzle-orm";
import db from "../database";
import { assetTable } from "../database/schema";
import { queueStorageCleanup } from "../storage/cleanup-queue";

export async function cleanupDraftUploads() {
  await db.transaction(async (tx) => {
    const expired = await tx
      .delete(assetTable)
      .where(
        and(
          inArray(assetTable.surface, ["draft", "draft-pending"]),
          isNull(assetTable.taskId),
          lt(assetTable.createdAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        ),
      )
      .returning({ objectKey: assetTable.objectKey });
    await queueStorageCleanup(
      tx,
      expired.map((asset) => asset.objectKey),
    );
  });
}
