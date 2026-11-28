import { Effect } from "effect";
import { Output } from "./output.js";
import type { Theme } from "./theme.js";

export const emit = Effect.fnUntraced(function* <A>(
  value: A,
  render: (theme: Theme, value: A) => ReadonlyArray<string>,
) {
  const output = yield* Output;
  if (output.mode === "json") {
    yield* output.out(`${JSON.stringify(value)}\n`);
    return;
  }
  yield* output.out(`${render(output.theme, value).join("\n")}\n`);
});
