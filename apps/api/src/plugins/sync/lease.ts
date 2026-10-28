import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { sql } from "drizzle-orm";
import db from "../../database";
import { SyncLeaseBusyError } from "./lease-busy-error";

const LEASE_MS = 15 * 60 * 1000;

export async function withSyncLease<T>(
  key: string,
  run: () => Promise<T>,
  { maxWaitMs = 5_000 }: { maxWaitMs?: number } = {},
): Promise<T> {
  const owner = randomUUID();
  const deadline = performance.now() + maxWaitMs;
  let retryDelay = 100;
  for (;;) {
    const claimed = await db.execute(sql`
      insert into job_lease (name, owner, expires_at)
      values (${key}, ${owner}, timezone('UTC', clock_timestamp()) + ${LEASE_MS} * interval '1 millisecond')
      on conflict (name) do update set owner = excluded.owner, expires_at = excluded.expires_at
      where job_lease.expires_at < timezone('UTC', clock_timestamp())
      returning name
    `);
    if (claimed.rowCount) break;
    const remaining = deadline - performance.now();
    if (remaining <= 0) throw new SyncLeaseBusyError();
    await delay(Math.min(retryDelay, remaining));
    retryDelay = Math.min(retryDelay * 2, 1_000);
  }
  // Claims use short statements rather than reserving application connections
  // during provider requests. Slow exports block only their own task key.
  const renewal = setInterval(() => {
    void db
      .execute(sql`
      update job_lease set expires_at = timezone('UTC', clock_timestamp()) + ${LEASE_MS} * interval '1 millisecond'
      where name = ${key} and owner = ${owner}
    `)
      .catch(() => {
        console.error("Sync creation lease renewal failed", { key });
      });
  }, 60_000);
  renewal.unref();
  try {
    return await run();
  } finally {
    clearInterval(renewal);
    await db.execute(
      sql`delete from job_lease where name = ${key} and owner = ${owner}`,
    );
  }
}
