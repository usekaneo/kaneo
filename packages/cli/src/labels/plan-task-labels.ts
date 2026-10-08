import { Result } from "effect";
import type { Label } from "../api/labels.js";
import { InvalidArgument } from "../errors/errors.js";
import { matchLabel, normalizeLabelName } from "./match-label.js";

export type TaskLabelPlan = {
  readonly add: ReadonlyArray<Label>;
  readonly remove: ReadonlyArray<Label>;
};

export function planTaskLabels(options: {
  readonly taskRef: string;
  readonly taskLabels: ReadonlyArray<Label>;
  readonly add: ReadonlyArray<Label>;
  readonly removeNames: ReadonlyArray<string>;
}): Result.Result<TaskLabelPlan, InvalidArgument> {
  const remove: Label[] = [];
  for (const name of options.removeNames) {
    const match = matchLabel(options.taskLabels, name);
    if (match.kind !== "found") {
      const names = options.taskLabels.map((label) => label.name);
      return Result.fail(
        new InvalidArgument({
          message: `${options.taskRef} has no label named "${name.trim()}".`,
          hint:
            names.length > 0
              ? `Its labels: ${names.join(", ")}.`
              : "It has no labels.",
        }),
      );
    }
    if (!remove.some((label) => label.id === match.label.id)) {
      remove.push(match.label);
    }
  }
  const removed = new Set(
    remove.map((label) => normalizeLabelName(label.name)),
  );
  const both = options.add.find((label) =>
    removed.has(normalizeLabelName(label.name)),
  );
  if (both) {
    return Result.fail(
      new InvalidArgument({
        message: `${both.name} is both added and removed.`,
        hint: "Pass it to --add-label or --remove-label, not both.",
      }),
    );
  }
  return Result.succeed({ add: options.add, remove });
}

export function describeLabelChanges(plan: TaskLabelPlan): string | null {
  const parts = [
    ...plan.add.map((label) => `+${label.name}`),
    ...plan.remove.map((label) => `-${label.name}`),
  ];
  return parts.length > 0 ? `labels ${parts.join(" ")}` : null;
}
