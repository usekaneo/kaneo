import { Duration, Effect } from "effect";
import { deleteLabelStep, type LabelDeletion } from "../api/labels.js";
import type { RateLimited } from "../errors/errors.js";
import { type DeletionOutcome, nextDeletionStep } from "./deletion-step.js";

type Attempt =
  | {
      readonly outcome: DeletionOutcome;
      readonly deletion: LabelDeletion;
    }
  | { readonly outcome: DeletionOutcome; readonly busy: RateLimited };

export const deleteLabelFully = Effect.fn("labels.deleteFully")(function* (
  id: string,
) {
  let waited = 0;
  for (;;) {
    const attempt: Attempt = yield* deleteLabelStep(id).pipe(
      Effect.map((deletion): Attempt => ({
        outcome: { kind: deletion.pendingDeletion ? "pending" : "deleted" },
        deletion,
      })),
      Effect.catchTag("RateLimited", (busy) =>
        Effect.succeed<Attempt>({
          outcome: { kind: "busy", retryAfterSeconds: busy.retryAfterSeconds },
          busy,
        }),
      ),
    );
    const step = nextDeletionStep(attempt.outcome, waited);
    if (step.kind === "done" && "deletion" in attempt) return attempt.deletion;
    if (step.kind === "give-up" && "busy" in attempt) {
      return yield* Effect.fail(attempt.busy);
    }
    if (step.kind === "wait") {
      waited += step.seconds;
      yield* Effect.sleep(Duration.seconds(step.seconds));
    }
  }
});
