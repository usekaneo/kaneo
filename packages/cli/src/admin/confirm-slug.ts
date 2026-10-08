import { Effect } from "effect";
import { Prompt } from "effect/cli";
import { Cancelled, InvalidArgument } from "../errors/errors.js";
import { note } from "../output/emit.js";
import { Output } from "../output/output.js";
import { promptTheme } from "../prompts/prompt-theme.js";

export const confirmBySlug = Effect.fnUntraced(function* (options: {
  readonly yes: boolean;
  readonly action: string;
  readonly warning: string;
  readonly slug: string;
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
    `  ${ui.theme.danger(ui.glyphs.warning)} ${options.warning}`,
    "",
  ]);
  const typed = yield* Prompt.run(
    Prompt.String({
      message: `Type ${options.slug} to confirm`,
      theme: promptTheme(output.ui),
    }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
  if (typed.trim() !== options.slug) {
    return yield* new InvalidArgument({
      message: `"${typed.trim()}" does not match ${options.slug}, so nothing changed.`,
      hint: "Type the slug exactly, or pass --yes in scripts.",
    });
  }
});
