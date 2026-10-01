import { randomUUID } from "node:crypto";
import { HTTPException } from "hono/http-exception";
import { and, eq, sql } from "drizzle-orm";
import db from "../database";
import {
  assetTable,
  jobLeaseTable,
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
  for (let offset = 0; offset < uniqueKeys.length; offset += 500)
    await tx
      .insert(storageCleanupTable)
      .values(
        uniqueKeys
          .slice(offset, offset + 500)
          .map((objectKey) => ({ objectKey })),
      )
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
      const verification = await tx.query.jobLeaseTable.findFirst({
        where: eq(jobLeaseTable.name, `storage-verification:${item.objectKey}`),
      });
      if (verification && verification.expiresAt > new Date()) return;
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

// Serialize reference changes, verification leases and deletion for this object only.
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

// A durable lease protects the object while verification runs without a pooled connection.
export async function withVerifiedStorageObject<Verified, Result>(
  objectKey: string,
  verify: () => Promise<Verified>,
  apply: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
    verified: Verified,
  ) => Promise<Result>,
): Promise<Result> {
  const name = `storage-verification:${objectKey}`;
  const owner = randomUUID();
  await withStorageObject(objectKey, async (tx) => {
    const current = await tx.query.jobLeaseTable.findFirst({
      where: eq(jobLeaseTable.name, name),
    });
    if (current && current.expiresAt > new Date())
      throw new HTTPException(503, {
        message: "Upload verification is already in progress.",
      });
    await tx
      .insert(jobLeaseTable)
      .values({ name, owner, expiresAt: new Date(Date.now() + 60_000) })
      .onConflictDoUpdate({
        target: jobLeaseTable.name,
        set: { owner, expiresAt: new Date(Date.now() + 60_000) },
      });
  });
  try {
    const verified = await verify();
    return await withStorageObject(objectKey, async (tx) => {
      const lease = await tx.query.jobLeaseTable.findFirst({
        where: eq(jobLeaseTable.name, name),
      });
      if (lease?.owner !== owner || lease.expiresAt <= new Date())
        throw new HTTPException(503, {
          message: "Upload verification expired; retry the upload.",
        });
      const result = await apply(tx, verified);
      await tx
        .delete(jobLeaseTable)
        .where(
          and(eq(jobLeaseTable.name, name), eq(jobLeaseTable.owner, owner)),
        );
      return result;
    });
  } finally {
    await db
      .delete(jobLeaseTable)
      .where(and(eq(jobLeaseTable.name, name), eq(jobLeaseTable.owner, owner)));
  }
}
