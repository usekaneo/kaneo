import { Cause, Effect, Exit, Option } from "effect";
import type { HTTPException } from "hono/http-exception";
import { DatabaseError } from "./database";

// Runs a controller effect at a Hono handler. Typed domain errors become the
// HTTPException the module maps them to. A DatabaseError rethrows its cause
// and a defect is rethrown as is, so Hono's onError renders the same JSON
// 500 and Sentry capture as an uncaught throw did before the migration.
export async function runHandler<A, E>(
  effect: Effect.Effect<A, E | DatabaseError>,
  toHttpException: (error: E) => HTTPException,
): Promise<A> {
  const exit = await Effect.runPromiseExit(effect);
  if (Exit.isSuccess(exit)) {
    return exit.value;
  }

  const error = Cause.findErrorOption(exit.cause);
  if (Option.isSome(error)) {
    if (error.value instanceof DatabaseError) {
      throw error.value.cause;
    }
    throw toHttpException(error.value as E);
  }

  throw Cause.squash(exit.cause);
}
