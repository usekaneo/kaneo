import { Effect } from "effect";
import { Output } from "./output.js";
import { renderWarning } from "./render-notice.js";

export const step = Effect.fnUntraced(function* (message: string) {
  const output = yield* Output;
  if (output.mode === "human")
    yield* output.out(`${output.theme.dim(message)}\n`);
});

export const warn = Effect.fnUntraced(function* (message: string) {
  const output = yield* Output;
  if (output.mode === "human")
    yield* output.err(`${renderWarning(output.errTheme, message)}\n`);
});
