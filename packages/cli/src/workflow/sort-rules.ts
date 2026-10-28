import { EVENTS, INTEGRATIONS } from "./events.js";
import type { RuleJson } from "./rule-json.js";

function rank(list: ReadonlyArray<string>, value: string): number {
  const index = list.indexOf(value);
  return index === -1 ? list.length : index;
}

export function sortRules(rules: ReadonlyArray<RuleJson>): RuleJson[] {
  return [...rules].sort(
    (a, b) =>
      rank(INTEGRATIONS, a.integration) - rank(INTEGRATIONS, b.integration) ||
      rank(EVENTS, a.event) - rank(EVENTS, b.event) ||
      a.id.localeCompare(b.id),
  );
}
