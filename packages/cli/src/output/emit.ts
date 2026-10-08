import { Effect, Option } from "effect";
import { JqFlag } from "../cli/global-flags.js";
import { applyJq } from "../jq/apply-jq.js";
import type { Ui } from "../render/ui.js";
import { Output } from "./output.js";

export const emit = Effect.fnUntraced(function* <A>(
  value: A,
  render: (ui: Ui, value: A) => ReadonlyArray<string>,
) {
  const output = yield* Output;
  const jq = Option.flatten(yield* Effect.serviceOption(JqFlag));
  if (Option.isSome(jq)) {
    yield* output.out(yield* applyJq(jq.value, value));
    return;
  }
  if (output.mode === "json") {
    yield* output.out(`${JSON.stringify(value)}\n`);
    return;
  }
  yield* output.out(`${render(output.ui, value).join("\n")}\n`);
});

export const note = Effect.fnUntraced(function* (
  render: (ui: Ui) => ReadonlyArray<string>,
) {
  const output = yield* Output;
  yield* output.err(`${render(output.errUi).join("\n")}\n`);
});
