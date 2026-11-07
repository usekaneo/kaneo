import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import db from ".";

export const SLOT_LEASE_MS = 2 * 60 * 1000;
const RENEW_EVERY_MS = 30 * 1000;

export function slotLeaseName(prefix: string, slot: number) {
  return `${prefix}:slot:${slot}`;
}

export function itemLeaseName(prefix: string, key: string) {
  return `${prefix}:item:${key}`;
}

async function claim(name: string, owner: string) {
  // expires_at has no time zone and holds UTC, like the other job_lease users.
  const claimed = await db.execute(sql`
    INSERT INTO job_lease ("name", "owner", "expires_at")
    VALUES (${name}, ${owner}, timezone('UTC', clock_timestamp()) + ${SLOT_LEASE_MS} * interval '1 millisecond')
    ON CONFLICT ("name") DO UPDATE
      SET "owner" = EXCLUDED."owner", "expires_at" = EXCLUDED."expires_at"
      WHERE job_lease."expires_at" < timezone('UTC', clock_timestamp())
    RETURNING "name";
  `);
  return (claimed.rowCount ?? 0) > 0;
}

/**
 * Runs `run` while holding one of `slots` shared slots and the lease for `key`.
 *
 * Every claim, renewal and release is a single autocommit statement on
 * job_lease, so nothing depends on staying on one database session. That keeps
 * it working behind a transaction-mode pooler such as PgBouncer, and no pooled
 * client is pinned while `run` awaits provider calls. If the process dies, the
 * leases expire after SLOT_LEASE_MS.
 */
export async function withLeaseSlots<T>(
  {
    prefix,
    slots,
    key,
    busy,
  }: { prefix: string; slots: number; key: string; busy: () => Error },
  run: () => Promise<T>,
): Promise<T> {
  const owner = randomUUID();
  let renewal: ReturnType<typeof setInterval> | undefined;
  try {
    let hasSlot = false;
    for (let slot = 0; slot < slots && !hasSlot; slot++)
      hasSlot = await claim(slotLeaseName(prefix, slot), owner);
    if (!hasSlot) throw busy();
    if (!(await claim(itemLeaseName(prefix, key), owner))) throw busy();

    renewal = setInterval(() => {
      void db
        .execute(sql`
          UPDATE job_lease
          SET "expires_at" = timezone('UTC', clock_timestamp()) + ${SLOT_LEASE_MS} * interval '1 millisecond'
          WHERE "owner" = ${owner};
        `)
        .catch((error) => {
          console.error(`Failed to renew the ${prefix} lease`, error);
        });
    }, RENEW_EVERY_MS);
    renewal.unref();

    return await run();
  } finally {
    clearInterval(renewal);
    // One owner per call, so this releases the slot and the item together.
    await db
      .execute(sql`DELETE FROM job_lease WHERE "owner" = ${owner};`)
      .catch((error) => {
        console.error(`Failed to release the ${prefix} lease`, error);
      });
  }
}
