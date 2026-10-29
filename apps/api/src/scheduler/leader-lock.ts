import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import db from "../database";

const INSTANCE_ID = randomUUID();

export const SEAT_RECONCILIATION_LEASE = "seat-reconciliation";

const DEFAULT_LEASE_MS = 15 * 60 * 1000;

export async function renewJobLease(
  name: string,
  leaseMs: number = DEFAULT_LEASE_MS,
): Promise<boolean> {
  const expiresAt = new Date(Date.now() + leaseMs);

  const renewed = await db.execute(sql`
    UPDATE job_lease SET "expires_at" = ${expiresAt}
    WHERE "name" = ${name} AND "owner" = ${INSTANCE_ID}
    RETURNING "name";
  `);

  return (renewed.rowCount ?? 0) > 0;
}

export async function withJobLease<T>(
  name: string,
  run: () => Promise<T>,
  whenHeldElsewhere: () => T,
  leaseMs: number = DEFAULT_LEASE_MS,
): Promise<T> {
  // expires_at has no time zone and holds UTC. Computing it in the database
  // keeps the lease independent of the Node process and session time zones.
  const claimed = await db.execute(sql`
    INSERT INTO job_lease ("name", "owner", "expires_at")
    VALUES (${name}, ${INSTANCE_ID}, timezone('UTC', clock_timestamp()) + ${leaseMs} * interval '1 millisecond')
    ON CONFLICT ("name") DO UPDATE
      SET "owner" = EXCLUDED."owner", "expires_at" = EXCLUDED."expires_at"
      WHERE job_lease."expires_at" < timezone('UTC', clock_timestamp())
    RETURNING "name";
  `);

  if ((claimed.rowCount ?? 0) === 0) {
    return whenHeldElsewhere();
  }

  try {
    return await run();
  } finally {
    await db
      .execute(
        sql`DELETE FROM job_lease WHERE "name" = ${name} AND "owner" = ${INSTANCE_ID};`,
      )
      .catch((error) => {
        console.error(`Failed to release the ${name} lease`, error);
      });
  }
}
