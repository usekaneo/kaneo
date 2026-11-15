import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import db from ".";
import { claimRequestLease } from "./claim-request-lease";
import {
  type LeaseTransaction,
  type RequestLease,
  REQUEST_LEASE_MS,
  REQUEST_LEASE_RENEWAL_MS,
} from "./request-lease";

/** Short transactions keep resource exclusion and slot limits pooler-safe. */
export async function withRequestLease<T>(
  scope: string,
  id: string,
  limit: number,
  busy: () => Error,
  run: (lease: RequestLease) => Promise<T>,
): Promise<T> {
  const owner = randomUUID();
  const resource = `request:${scope}:resource:${id}`;
  const slots = Array.from(
    { length: limit },
    (_, i) => `request:${scope}:slot:${i}`,
  );
  const possibleNames = [resource, ...slots];
  let names: string[] = [];
  let failure: Error | undefined;
  let deadline = performance.now() + REQUEST_LEASE_MS;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let renewal: Promise<void> | undefined;

  const assertLive = () => {
    if (performance.now() >= deadline) failure ??= busy();
    if (failure) throw failure;
  };
  const renew = async (tx: LeaseTransaction) => {
    // Use the same resource-before-slot order as acquisition. Recheck expiry
    // after taking row locks, so time spent waiting cannot revive a stale lease.
    await tx.execute(sql`
      SELECT name FROM job_lease
      WHERE name IN (${sql.join(
        names.map((name) => sql`${name}`),
        sql`, `,
      )})
      ORDER BY name FOR UPDATE
    `);
    const result = await tx.execute(sql`
      UPDATE job_lease
      SET expires_at = timezone('UTC', clock_timestamp()) + ${REQUEST_LEASE_MS} * interval '1 millisecond'
      WHERE name IN (${sql.join(
        names.map((name) => sql`${name}`),
        sql`, `,
      )})
        AND owner = ${owner}
        AND expires_at > timezone('UTC', clock_timestamp())
      RETURNING name
    `);
    if (result.rowCount !== names.length) {
      failure ??= busy();
      throw failure;
    }
  };
  const lease: RequestLease = {
    async check() {
      assertLive();
      if (!renewal) {
        const started = performance.now();
        renewal = db
          .transaction(renew)
          .then(() => {
            assertLive();
            deadline = Math.max(deadline, started + REQUEST_LEASE_MS);
          })
          .catch((error: unknown) => {
            failure ??=
              error instanceof Error
                ? error
                : new Error("Request lease renewal failed");
            throw failure;
          })
          .finally(() => {
            renewal = undefined;
          });
      }
      await renewal;
    },
    async transaction(runTransaction) {
      assertLive();
      const started = performance.now();
      const result = await db.transaction(async (tx) => {
        await renew(tx);
        assertLive();
        const value = await runTransaction(tx);
        assertLive();
        return value;
      });
      deadline = Math.max(deadline, started + REQUEST_LEASE_MS);
      return result;
    },
  };
  const scheduleRenewal = () => {
    timer = setTimeout(() => {
      void lease
        .check()
        .catch(() => {
          // check records the failure; subsequent work must stop at a checkpoint.
        })
        .finally(() => {
          if (!stopped && !failure) scheduleRenewal();
        });
    }, REQUEST_LEASE_RENEWAL_MS);
    timer.unref();
  };

  try {
    names = await claimRequestLease(resource, slots, owner, busy);
    assertLive();
    scheduleRenewal();
    const result = await run(lease);
    await lease.check();
    return result;
  } finally {
    stopped = true;
    clearTimeout(timer);
    await renewal?.catch(() => {});
    // Also clean up an acquisition whose COMMIT reply was lost. A unique owner
    // prevents a delayed cleanup from deleting a successor's leases.
    await db
      .execute(sql`
      DELETE FROM job_lease WHERE owner = ${owner}
        AND name IN (${sql.join(
          possibleNames.map((name) => sql`${name}`),
          sql`, `,
        )})
    `)
      .catch(() => {
        // Expiration recovers capacity if the database is temporarily unavailable.
        console.error("Failed to release request leases", { scope });
      });
  }
}
