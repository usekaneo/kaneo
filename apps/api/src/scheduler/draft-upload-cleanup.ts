import { and, asc, inArray, isNull, lt, sql } from "drizzle-orm";
import db from "../database";
import { assetTable } from "../database/schema";
import { queueStorageCleanup } from "../storage/cleanup-queue";

export async function cleanupDraftUploads() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const deadline = Date.now() + 60_000;
  do {
    const count = await db.transaction(async (tx) => {
      const batch = await tx
        .select({ id: assetTable.id })
        .from(assetTable)
        .where(
          and(
            sql`${assetTable.surface} in ('draft', 'draft-pending')`,
            isNull(assetTable.taskId),
            lt(assetTable.createdAt, cutoff),
          ),
        )
        .orderBy(asc(assetTable.createdAt), asc(assetTable.id))
        .limit(500)
        .for("update", { skipLocked: true });
      if (!batch.length) return 0;
      const expired = await tx
        .delete(assetTable)
        .where(
          inArray(
            assetTable.id,
            batch.map((asset) => asset.id),
          ),
        )
        .returning({ objectKey: assetTable.objectKey });
      await queueStorageCleanup(
        tx,
        expired.map((asset) => asset.objectKey),
      );
      return expired.length;
    });
    if (count < 500) break;
  } while (Date.now() < deadline);
}
