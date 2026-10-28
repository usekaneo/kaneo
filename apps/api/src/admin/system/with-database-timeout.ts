import { sql } from "drizzle-orm";
import db from "../../database";
import { withTimeout } from "./with-timeout";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** Bound the response and the SQL work, without changing the shared pool. */
export function withDatabaseTimeout<T>(
  work: (tx: Transaction, signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const deadline = performance.now() + timeoutMs;
  return withTimeout(
    (signal) =>
      db.transaction(async (tx) => {
        // A queued pool checkout may finish after the response timed out.
        signal.throwIfAborted();
        const remainingMs = Math.max(
          1,
          Math.ceil(deadline - performance.now()),
        );
        await tx.execute(
          sql`select set_config('statement_timeout', ${String(remainingMs)}, true)`,
        );
        signal.throwIfAborted();
        return work(tx, signal);
      }),
    timeoutMs,
  );
}
