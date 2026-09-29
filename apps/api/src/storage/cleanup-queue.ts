import { eq, sql } from "drizzle-orm";
import db from "../database";
import {
  assetTable,
  projectTable,
  storageCleanupTable,
} from "../database/schema";
import { deleteS3Object } from "./s3";

export async function queueStorageCleanup(
  tx: Pick<typeof db, "insert">,
  keys: string[],
) {
  const uniqueKeys = [...new Set(keys)];
  if (!uniqueKeys.length) return;
  await tx
    .insert(storageCleanupTable)
    .values(uniqueKeys.map((objectKey) => ({ objectKey })))
    .onConflictDoNothing();
}

export async function retryStorageCleanup(): Promise<{ degraded: boolean }> {
  const ranked = db
    .select({
      objectKey: storageCleanupTable.objectKey,
      lastAttemptAt: storageCleanupTable.lastAttemptAt,
      rank: sql<number>`row_number() over (partition by ${storageCleanupTable.lastAttemptAt} is null order by coalesce(${storageCleanupTable.lastAttemptAt}, ${storageCleanupTable.createdAt}), ${storageCleanupTable.objectKey})`.as(
        "cleanup_rank",
      ),
    })
    .from(storageCleanupTable)
    .as("ranked_cleanup");
  const pending = await db
    .select()
    .from(ranked)
    .orderBy(ranked.rank, ranked.lastAttemptAt, ranked.objectKey)
    .limit(100);
  let degraded = false;
  for (const item of pending) {
    await withStorageObject(item.objectKey, async (tx) => {
      const queued = await tx.query.storageCleanupTable.findFirst({
        where: eq(storageCleanupTable.objectKey, item.objectKey),
      });
      if (!queued) return;
      const [asset] = await tx
        .select({ id: assetTable.id })
        .from(assetTable)
        .where(eq(assetTable.objectKey, item.objectKey))
        .for("key share");
      const [background] = await tx
        .select({ id: projectTable.id })
        .from(projectTable)
        .where(eq(projectTable.backgroundObjectKey, item.objectKey))
        .for("key share");
      if (asset || background) {
        await tx
          .delete(storageCleanupTable)
          .where(eq(storageCleanupTable.objectKey, item.objectKey));
        return;
      }
      try {
        await deleteS3Object(item.objectKey);
        await tx
          .delete(storageCleanupTable)
          .where(eq(storageCleanupTable.objectKey, item.objectKey));
      } catch (error) {
        degraded = true;
        // Provider identifiers diagnose failures without exposing uploaded paths.
        const failure = error as {
          name?: string;
          code?: string;
          $metadata?: { httpStatusCode?: number };
        } | null;
        console.error("Storage cleanup failed", {
          name: failure?.name,
          code: failure?.code,
          status: failure?.$metadata?.httpStatusCode,
        });
        await tx
          .update(storageCleanupTable)
          .set({ lastAttemptAt: new Date() })
          .where(eq(storageCleanupTable.objectKey, item.objectKey));
      }
    });
  }
  return { degraded };
}

// Coordinate finalization and deletion of this object only. Verification runs
// inside this lock so a finalizer waiting behind cleanup sees the missing object.
export async function withStorageObject<T>(
  objectKey: string,
  apply: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtext('storage-object'), hashtext(${objectKey}))`,
    );
    return apply(tx);
  });
}
