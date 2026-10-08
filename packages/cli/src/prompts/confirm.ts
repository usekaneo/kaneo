import { Effect } from "effect";
import { Prompt } from "effect/cli";
import { Cancelled } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { promptTheme } from "./prompt-theme.js";

export const confirm = Effect.fnUntraced(function* (message: string) {
  const output = yield* Output;
  return yield* Prompt.run(
    Prompt.Confirm({ message, initial: false, theme: promptTheme(output.ui) }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
});
