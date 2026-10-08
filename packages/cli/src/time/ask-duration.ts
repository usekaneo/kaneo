import { Effect, Option, Result } from "effect";
import { Prompt } from "effect/cli";
import { Cancelled, InvalidArgument } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { promptTheme } from "../prompts/prompt-theme.js";
import { parseDuration } from "./duration.js";

export const askDuration = Effect.fnUntraced(function* (
  input: Option.Option<string>,
  example: string,
) {
  if (Option.isSome(input)) {
    return yield* Effect.fromResult(parseDuration(input.value));
  }
  const output = yield* Output;
  if (!output.interactive) {
    return yield* new InvalidArgument({
      message: "A duration is required.",
      hint: `Pass it after the task, for example ${example}.`,
    });
  }
  return yield* Prompt.run(
    Prompt.String({
      message: "How long (for example 1h30m)",
      validate: (value) => {
        const parsed = parseDuration(value);
        return Result.isSuccess(parsed)
          ? Effect.succeed(String(parsed.success))
          : Effect.fail(parsed.failure.hint ?? parsed.failure.message);
      },
      theme: promptTheme(output.ui),
    }),
  ).pipe(
    Effect.map(Number),
    Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())),
  );
});
