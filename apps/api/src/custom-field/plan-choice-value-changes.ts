import { HTTPException } from "hono/http-exception";
import {
  type ChoiceType,
  convertChoiceValue,
  findUsedOptions,
} from "./choice-options";

export type ChoiceValueChange = {
  from: string;
  to: string;
};

type PlanInput = {
  values: Array<string | null>;
  from: ChoiceType;
  to: ChoiceType;
  removedOptions: string[];
};

function quote(options: string[]) {
  return options.map((option) => `"${option}"`).join(", ");
}

export function planChoiceValueChanges({
  values,
  from,
  to,
  removedOptions,
}: PlanInput): ChoiceValueChange[] {
  const used = findUsedOptions(values, from, removedOptions);
  if (used.length > 0) {
    throw new HTTPException(400, {
      message: `Can't remove ${quote(used)} because tasks still use ${used.length === 1 ? "it" : "them"}. Pick a different option on those tasks first.`,
    });
  }

  if (from === to) return [];

  const changes: ChoiceValueChange[] = [];
  for (const value of new Set(values)) {
    if (value === null) continue;

    const converted = convertChoiceValue(value, from, to);
    if (converted === undefined) {
      throw new HTTPException(400, {
        message:
          "Some tasks have more than one option picked. Leave one option on those tasks first.",
      });
    }
    if (converted !== value) changes.push({ from: value, to: converted });
  }

  return changes;
}
