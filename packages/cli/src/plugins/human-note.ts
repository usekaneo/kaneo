import { Effect } from "effect";
import { note } from "../output/emit.js";
import { Output } from "../output/output.js";
import type { Ui } from "../render/ui.js";

export const humanNote = Effect.fnUntraced(function* (
  render: (ui: Ui) => ReadonlyArray<string>,
) {
  const output = yield* Output;
  if (output.mode === "human") yield* note(render);
});
