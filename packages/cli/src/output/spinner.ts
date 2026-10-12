import { Effect, Fiber } from "effect";
import { Output } from "./output.js";

const SHOW_AFTER = "150 millis";
const FRAME = "80 millis";

export const withSpinner =
  (label: string) =>
  <A, E, R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R | Output> =>
    Effect.gen(function* () {
      const output = yield* Output;
      const { caps, glyphs, theme } = output.errUi;
      if (output.mode === "json" || !caps.animate) return yield* self;

      let started = false;
      const animation = Effect.gen(function* () {
        yield* Effect.sleep(SHOW_AFTER);
        started = true;
        yield* output.err("\u001b[?25l");
        for (let frame = 0; ; frame++) {
          const glyph = glyphs.spinner[frame % glyphs.spinner.length] ?? "";
          yield* output.err(`\r${theme.muted(glyph)} ${label}\u001b[K`);
          yield* Effect.sleep(FRAME);
        }
      });

      return yield* Effect.acquireUseRelease(
        Effect.forkDetach(animation),
        () => self,
        (fiber) =>
          Fiber.interrupt(fiber).pipe(
            Effect.andThen(
              Effect.suspend(() =>
                started ? output.err("\r\u001b[K\u001b[?25h") : Effect.void,
              ),
            ),
          ),
      );
    });
