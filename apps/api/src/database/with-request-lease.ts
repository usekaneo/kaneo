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

const active = new Set<() => Promise<boolean>>();
let shuttingDown = false;

export async function stopActiveRequestLeases(timeoutMs = 5_000) {
  shuttingDown = true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      Promise.all([...active].map((stop) => stop())).then((results) =>
        results.every(Boolean),
      ),
      new Promise<boolean>((resolve) => {
        timer = setTimeout(() => resolve(false), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Short transactions keep resource exclusion and slot limits pooler-safe. */
export async function withRequestLease<T>(
  scope: string,
  id: string,
  limit: number,
  busy: () => Error,
  run: (lease: RequestLease) => Promise<T>,
): Promise<T> {
  if (shuttingDown) throw busy();
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

  const acquisition = claimRequestLease(resource, slots, owner, busy);
  let releasing: Promise<boolean> | undefined;
  const release = () => {
    stopped = true;
    clearTimeout(timer);
    return (releasing ??= (async () => {
      // Acquisition may have committed even if its reply was lost. Wait for it
      // and any renewal before releasing; DELETE also waits for fenced writes.
      await acquisition.catch(() => {});
      await renewal?.catch(() => {});
      try {
        await db.execute(sql`
          DELETE FROM job_lease WHERE owner = ${owner}
            AND name IN (${sql.join(
              possibleNames.map((name) => sql`${name}`),
              sql`, `,
            )})
        `);
        return true;
      } catch {
        console.error("Failed to release request leases", { scope });
        return false;
      }
    })());
  };
  const stop = () => {
    // A remote call cannot be recalled, but its completion must not start more
    // effects or acknowledge progress after shutdown releases ownership.
    failure ??= busy();
    return release();
  };
  active.add(stop);
  try {
    names = await acquisition;
    assertLive();
    scheduleRenewal();
    const result = await run(lease);
    await lease.check();
    return result;
  } finally {
    await release();
    active.delete(stop);
  }
}
