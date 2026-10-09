import { Result } from "effect";
import type { Label } from "../api/labels.js";
import { InvalidArgument } from "../errors/errors.js";
import { matchLabel, quoteName, workspaceLabels } from "./match-label.js";

function existingHint(labels: ReadonlyArray<Label>): string {
  if (labels.length === 0) return "This workspace has no labels yet.";
  const names = labels
    .map((label) => label.name)
    .sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  const shown = names.slice(0, 10).join(", ");
  return names.length > 10
    ? `Existing labels: ${shown}, and ${names.length - 10} more.`
    : `Existing labels: ${shown}.`;
}

export function pickLabels(
  labels: ReadonlyArray<Label>,
  names: ReadonlyArray<string>,
): Result.Result<ReadonlyArray<Label>, InvalidArgument> {
  const available = workspaceLabels(labels);
  const picked: Label[] = [];
  const missing: string[] = [];
  for (const name of names) {
    const match = matchLabel(available, name);
    if (match.kind === "none") {
      if (!missing.includes(name.trim())) missing.push(name.trim());
      continue;
    }
    if (match.kind === "ambiguous") {
      return Result.fail(
        new InvalidArgument({
          message: `"${name.trim()}" matches ${match.candidates.length} labels.`,
          hint: `Pass the label id instead: ${match.candidates.map((label) => `${label.name} (${label.id})`).join(", ")}.`,
        }),
      );
    }
    if (match.label.deletionStartedAt) {
      return Result.fail(
        new InvalidArgument({
          message: `The label ${match.label.name} is being deleted.`,
          hint: `Run kaneo label delete ${quoteName(match.label.name)} to finish deleting it.`,
        }),
      );
    }
    if (!picked.some((label) => label.id === match.label.id)) {
      picked.push(match.label);
    }
  }
  const [first] = missing;
  if (first === undefined) return Result.succeed(picked);
  return Result.fail(
    new InvalidArgument({
      message:
        missing.length === 1
          ? `No label named "${first}" in this workspace.`
          : `No labels named ${missing.map((name) => `"${name}"`).join(", ")} in this workspace.`,
      hint: `${existingHint(available)} Create one with kaneo label create ${quoteName(first)}.`,
    }),
  );
}
