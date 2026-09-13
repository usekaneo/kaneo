import { Cause, Effect, Exit, Option } from "effect";
import type { HTTPException } from "hono/http-exception";
import { DatabaseError } from "./database";

// A DatabaseError's cause and any defect are rethrown unchanged so Hono's
// onError keeps rendering the same JSON 500 and Sentry capture as before.
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
