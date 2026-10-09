import { Result } from "effect";
import type { Label } from "../api/labels.js";
import { InvalidArgument } from "../errors/errors.js";
import { normalizeLabelName } from "../labels/match-label.js";

export function labelForRemoval(
  labels: ReadonlyArray<Label>,
  reference: string,
): Result.Result<Label, InvalidArgument> {
  const trimmed = reference.trim();
  const wanted = normalizeLabelName(reference);
  const named = labels.filter(
    (label) =>
      label.id === trimmed || normalizeLabelName(label.name) === wanted,
  );
  const match =
    named.find((label) => label.id === trimmed) ??
    named.find((label) => label.taskId === null) ??
    named[0];
  return match
    ? Result.succeed(match)
    : Result.fail(
        new InvalidArgument({
          message: `No label named "${trimmed}" in this workspace.`,
          hint: "Run kaneo label list to see the label names.",
        }),
      );
}
