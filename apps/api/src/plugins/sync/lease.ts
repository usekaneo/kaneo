import type { PoolClient } from "pg";
import { getDatabasePool } from "../../database";

const queues = new Map<string, Promise<unknown>>();
const waiting: Array<() => void> = [];
let active = 0;
const MAX_CONCURRENT_SYNC = 2;

// Reserve only two pool connections for session locks. Provider callbacks and
// ordinary requests can still use the rest of the pool during network calls.
export function withSyncLease<T>(
  key: string,
  run: () => Promise<T>,
): Promise<T> {
  const previous = queues.get(key) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      if (active >= MAX_CONCURRENT_SYNC)
        await new Promise<void>((resolve) => waiting.push(resolve));
      else active++;
      let client: PoolClient | undefined;
      let locked = false;
      let releaseError: Error | undefined;
      try {
        client = await getDatabasePool().connect();
        // Wait for competing instances, then recheck the link in run(). A failed
        // first attempt must not consume a competing task's creation attempt.
        await client.query("select pg_advisory_lock(hashtextextended($1, 0))", [
          key,
        ]);
        locked = true;
        return await run();
      } finally {
        if (client) {
          try {
            if (locked)
              await client.query(
                "select pg_advisory_unlock(hashtextextended($1, 0))",
                [key],
              );
          } catch (error) {
            releaseError =
              error instanceof Error
                ? error
                : new Error("Sync lock release failed");
          }
          client.release(releaseError);
        }
        const resume = waiting.shift();
        if (resume) resume();
        else active--;
      }
    });
  queues.set(key, next);
  void next
    .finally(() => {
      if (queues.get(key) === next) queues.delete(key);
    })
    .catch(() => {});
  return next;
}
