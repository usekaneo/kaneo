import { Effect } from "effect";
import { Prompt } from "effect/cli";
import { Cancelled } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { promptTheme } from "./prompt-theme.js";

export type Choice<A> = {
  readonly title: string;
  readonly value: A;
  readonly description?: string;
};

export const pick = Effect.fnUntraced(function* <A>(
  message: string,
  choices: ReadonlyArray<Choice<A>>,
) {
  const output = yield* Output;
  return yield* Prompt.run(
    Prompt.AutoComplete({
      message,
      choices: choices.map((choice) => ({
        title: choice.title,
        value: choice.value,
        description: choice.description,
      })),
      filterPlaceholder: "Type to search",
      emptyMessage: "No matches",
      maxPerPage: 8,
      theme: promptTheme(output.ui),
    }),
  ).pipe(Effect.catchTag("QuitError", () => Effect.fail(new Cancelled())));
});
