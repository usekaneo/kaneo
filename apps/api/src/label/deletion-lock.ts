import { HTTPException } from "hono/http-exception";
import type { PoolClient } from "pg";
import { getDatabasePool } from "../database";

export const MAX_LABEL_DELETIONS_IN_FLIGHT = 4;
const LOCK_NAMESPACE = 773622;
let active = 0;

function busy() {
  return new HTTPException(429, {
    res: new Response("Label deletion is busy; retry this request", {
      status: 429,
      headers: { "Retry-After": "1" },
    }),
  });
}

/** Session locks span awaited provider calls without holding a SQL transaction. */
export async function withLabelDeletionLock<T>(
  id: string,
  run: () => Promise<T>,
): Promise<T> {
  if (active >= MAX_LABEL_DELETIONS_IN_FLIGHT) throw busy();
  active++;
  let client: PoolClient | undefined;
  let slot: number | undefined;
  let labelLocked = false;
  let releaseError: Error | undefined;
  try {
    client = await getDatabasePool().connect();
    for (
      let candidate = 0;
      candidate < MAX_LABEL_DELETIONS_IN_FLIGHT;
      candidate++
    ) {
      const { rows } = await client.query(
        "SELECT pg_try_advisory_lock($1::int, $2::int) AS acquired",
        [LOCK_NAMESPACE, candidate],
      );
      if (rows[0]?.acquired) {
        slot = candidate;
        break;
      }
    }
    if (slot === undefined) throw busy();
    const { rows } = await client.query(
      "SELECT pg_try_advisory_lock(hashtextextended($1, 0)) AS acquired",
      [`label-delete:${id}`],
    );
    labelLocked = rows[0]?.acquired === true;
    if (!labelLocked) throw busy();
    return await run();
  } finally {
    if (client) {
      try {
        if (labelLocked)
          await client.query(
            "SELECT pg_advisory_unlock(hashtextextended($1, 0))",
            [`label-delete:${id}`],
          );
        if (slot !== undefined)
          await client.query("SELECT pg_advisory_unlock($1::int, $2::int)", [
            LOCK_NAMESPACE,
            slot,
          ]);
      } catch (error) {
        // Destroy a connection whose lock release was not confirmed.
        releaseError =
          error instanceof Error
            ? error
            : new Error("Label lock release failed");
      }
      client.release(releaseError);
    }
    active--;
  }
}
