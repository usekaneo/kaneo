import { getDatabasePool } from "../database";

export const SEAT_RECONCILIATION_LOCK = 1525;

export async function withLeaderLock<T>(
  lockKey: number,
  run: () => Promise<T>,
  whenHeldElsewhere: () => T,
): Promise<T> {
  const client = await getDatabasePool().connect();
  let acquired = false;
  let released = false;

  try {
    const result = await client.query<{ locked: boolean }>(
      "SELECT pg_try_advisory_lock($1) AS locked",
      [lockKey],
    );
    acquired = result.rows[0]?.locked === true;

    if (!acquired) {
      client.release();
      released = true;
      return whenHeldElsewhere();
    }

    return await run();
  } finally {
    let unlockError: unknown;

    if (acquired) {
      unlockError = await client
        .query("SELECT pg_advisory_unlock($1)", [lockKey])
        .then(() => undefined)
        .catch((err) => err);

      if (unlockError) {
        console.error(
          `Failed to release advisory lock ${lockKey}`,
          unlockError,
        );
      }
    }

    if (!released) {
      client.release(unlockError ? true : undefined);
    }
  }
}
