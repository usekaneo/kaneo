import { Effect, Option } from "effect";
import type { Label } from "../api/labels.js";
import { InvalidArgument } from "../errors/errors.js";
import { Output } from "../output/output.js";
import { pick } from "../prompts/pick.js";
import { labelColorName } from "./label-colors.js";
import { matchLabel } from "./match-label.js";

export const chooseLabel = Effect.fn("labels.choose")(function* (
  labels: ReadonlyArray<Label>,
  reference: Option.Option<string>,
  example: string,
) {
  const output = yield* Output;
  if (Option.isNone(reference)) {
    if (labels.length === 0) {
      return yield* new InvalidArgument({
        message: "This workspace has no labels yet.",
        hint: "Create one with kaneo label create <name>.",
      });
    }
    if (output.interactive) {
      return yield* pick(
        "Choose a label",
        labels.map((label) => ({
          title: label.name,
          value: label,
          description: labelColorName(label.color) ?? label.color,
        })),
      );
    }
    return yield* new InvalidArgument({
      message: "A label is required.",
      hint: `Pass a label name or id, for example ${example}.`,
    });
  }
  const match = matchLabel(labels, reference.value);
  if (match.kind === "found") return match.label;
  if (match.kind === "ambiguous") {
    return yield* new InvalidArgument({
      message: `"${reference.value.trim()}" matches ${match.candidates.length} labels.`,
      hint: `Pass the label id instead: ${match.candidates.map((label) => `${label.name} (${label.id})`).join(", ")}.`,
    });
  }
  return yield* new InvalidArgument({
    message: `No label named "${reference.value.trim()}" in this workspace.`,
    hint: "Run kaneo label list to see the labels.",
  });
});
