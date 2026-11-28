import { setTimeout } from "node:timers/promises";

function isDeadlock(error: unknown): boolean {
  let cause = error;
  while (cause instanceof Error) {
    if ("code" in cause && cause.code === "40P01") return true;
    cause = cause.cause;
  }
  return false;
}

// Each attempt must open a fresh transaction. PostgreSQL has rolled back a
// deadlock victim, so only its database work is safe to retry, never providers
// or events. The label guard can deadlock with writers that already own rows.
export async function retryLabelTransaction<T>(
  run: () => Promise<T>,
  exhausted: () => Error,
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await run();
    } catch (error) {
      if (!isDeadlock(error)) throw error;
      if (attempt === 2) throw exhausted();
      // Release all transaction locks before allowing the survivor to finish.
      await setTimeout(10 * (attempt + 1));
    }
  }
}
