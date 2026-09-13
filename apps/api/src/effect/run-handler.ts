import { Cause, Effect, Exit, type Layer, Option } from "effect";
import type { HTTPException } from "hono/http-exception";
import { DatabaseError } from "./database";
import { NotFound, notFoundToHttpException } from "./errors";

// A DatabaseError's cause and any defect are rethrown unchanged so Hono's
// onError keeps rendering the same JSON 500 and Sentry capture as before.
export async function runHandler<A, E>(
  effect: Effect.Effect<A, E | NotFound | DatabaseError>,
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
    if (error.value instanceof NotFound) {
      throw notFoundToHttpException(error.value);
    }
    throw toHttpException(error.value as E);
  }

  throw Cause.squash(exit.cause);
}

export function makeRunner<R, E>(
  layer: Layer.Layer<R>,
  toHttpException: (error: E) => HTTPException,
) {
  return <A, E2 extends E>(
    effect: Effect.Effect<A, E2 | NotFound | DatabaseError, R>,
  ): Promise<A> => runHandler(Effect.provide(effect, layer), toHttpException);
}
