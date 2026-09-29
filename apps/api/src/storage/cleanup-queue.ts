import { eq, sql } from "drizzle-orm";
import db from "../database";
import { storageCleanupTable } from "../database/schema";
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
  const pending = await db
    .select()
    .from(storageCleanupTable)
    .orderBy(
      sql`${storageCleanupTable.lastAttemptAt} nulls first`,
      storageCleanupTable.createdAt,
    )
    .limit(100);
  let degraded = false;
  for (const item of pending) {
    try {
      await deleteS3Object(item.objectKey);
      await db
        .delete(storageCleanupTable)
        .where(eq(storageCleanupTable.objectKey, item.objectKey));
    } catch {
      // Keep the durable key for the next tick, without logging uploaded paths.
      degraded = true;
      await db
        .update(storageCleanupTable)
        .set({ lastAttemptAt: new Date() })
        .where(eq(storageCleanupTable.objectKey, item.objectKey));
    }
  }
  return { degraded };
}
