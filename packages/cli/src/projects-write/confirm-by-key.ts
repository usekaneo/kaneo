import { Effect } from "effect";
import { Prompt } from "effect/cli";
import { Cancelled, InvalidArgument } from "../errors/errors.js";
import { note } from "../output/emit.js";
import { Output } from "../output/output.js";
import { promptTheme } from "../prompts/prompt-theme.js";

function same(a: string, b: string): boolean {
  return (
    a.normalize("NFKC").trim().toLowerCase() ===
    b.normalize("NFKC").trim().toLowerCase()
  );
}

export const confirmByKey = Effect.fnUntraced(function* (options: {
  readonly yes: boolean;
  readonly action: string;
  readonly key: string;
  readonly warning: string;
}) {
  if (options.yes) return;
  const output = yield* Output;
  if (!output.interactive) {
    return yield* new InvalidArgument({
      message: `${options.action} needs confirmation.`,
      hint: "Pass --yes to skip the prompt.",
    });
  }
  yield* note((ui) => [
    "",
    `  ${ui.theme.warning(ui.glyphs.warning)} ${options.warning}`,
    "",
  ]);
  yield* Prompt.run(
    Prompt.String({
      message: `Type ${options.key} to confirm`,
      validate: (value) =>
        same(value, options.key)
          ? Effect.succeed(value)
          : Effect.fail(`Type ${options.key}, or press Ctrl+C to cancel`),
      theme: promptTheme(output.ui),
    }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
});
