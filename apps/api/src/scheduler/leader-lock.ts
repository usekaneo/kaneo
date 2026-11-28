import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import db from "../database";

const INSTANCE_ID = randomUUID();

export const SEAT_RECONCILIATION_LEASE = "seat-reconciliation";

const DEFAULT_LEASE_MS = 15 * 60 * 1000;

// expires_at is a timezone-free UTC timestamp. Both leases and renewals
// use the database clock, independent of process and session time zones.
const utcNow = sql`timezone('UTC', clock_timestamp())`;

type JobLeaseOptions = {
  leaseMs?: number;
  scheduledAt?: Date;
};

export async function renewJobLease(
  name: string,
  scheduledAt: Date,
  leaseMs: number,
): Promise<boolean> {
  const renewed = await db.execute(sql`
    UPDATE job_lease SET "expires_at" = ${utcNow} + ${leaseMs} * interval '1 millisecond'
    WHERE "name" = ${name}
      AND "owner" = ${INSTANCE_ID}
      AND "last_scheduled_at" = ${scheduledAt.toISOString()}::timestamptz
      AND "expires_at" > ${utcNow}
    RETURNING "name";
  `);

  return (renewed.rowCount ?? 0) > 0;
}

export async function withJobLease<T>(
  name: string,
  run: () => Promise<T>,
  whenHeldElsewhere: () => T,
  { leaseMs = DEFAULT_LEASE_MS, scheduledAt }: JobLeaseOptions = {},
): Promise<T> {
  const occurrence = scheduledAt?.toISOString() ?? null;
  const claimed = await db.execute(sql`
    INSERT INTO job_lease ("name", "owner", "expires_at", "last_scheduled_at")
    VALUES (
      ${name}, ${INSTANCE_ID}, ${utcNow} + ${leaseMs} * interval '1 millisecond',
      ${occurrence}::timestamptz
    )
    ON CONFLICT ("name") DO UPDATE
      SET "owner" = EXCLUDED."owner",
          "expires_at" = EXCLUDED."expires_at",
          "last_scheduled_at" = EXCLUDED."last_scheduled_at"
      WHERE job_lease."expires_at" < ${utcNow}
        AND (
          job_lease."last_scheduled_at" IS NULL
          OR job_lease."last_scheduled_at" < EXCLUDED."last_scheduled_at"
        )
    RETURNING "name";
  `);

  if ((claimed.rowCount ?? 0) === 0) {
    return whenHeldElsewhere();
  }

  try {
    return await run();
  } finally {
    // A scheduled callback may already have side effects when it fails.
    // Keep the high-water mark so another replica skips that occurrence.
    const release = occurrence
      ? sql`
          UPDATE job_lease SET "expires_at" = ${utcNow}
          WHERE "name" = ${name} AND "owner" = ${INSTANCE_ID}
            AND "last_scheduled_at" = ${occurrence}::timestamptz;
        `
      : sql`DELETE FROM job_lease WHERE "name" = ${name} AND "owner" = ${INSTANCE_ID};`;

    await db.execute(release).catch((error) => {
      console.error(`Failed to release the ${name} lease`, error);
    });
  }
}
