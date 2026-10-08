import { Effect } from "effect";
import type { ApiFailure } from "../errors/errors.js";
import { InvalidArgument } from "../errors/errors.js";

function notYours(id: string): InvalidArgument {
  return new InvalidArgument({
    message: `Comment ${id} was not found, or someone else wrote it.`,
    hint: "You can only change your own comments. Run kaneo comment list <task> to see the ids.",
  });
}

export const asOwnComment =
  (id: string) =>
  <A, R>(
    effect: Effect.Effect<A, ApiFailure, R>,
  ): Effect.Effect<A, ApiFailure | InvalidArgument, R> =>
    effect.pipe(
      Effect.catchTags({
        NotFound: () => Effect.fail(notYours(id)),
        InvalidRequest: (error) =>
          /could not be determined|not found/iu.test(error.message)
            ? Effect.fail(notYours(id))
            : Effect.fail(error),
      }),
    );
