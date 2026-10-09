import type { RuleJson } from "./rule-json.js";

export type RuleMatch =
  | { readonly kind: "found"; readonly rule: RuleJson }
  | { readonly kind: "ambiguous"; readonly rules: ReadonlyArray<RuleJson> }
  | { readonly kind: "none" };

export function matchRule(
  rules: ReadonlyArray<RuleJson>,
  target: {
    readonly id?: string;
    readonly event?: string;
    readonly integration?: string;
  },
): RuleMatch {
  const byId = target.id
    ? rules.find((rule) => rule.id === target.id)
    : undefined;
  if (byId) return { kind: "found", rule: byId };
  if (!target.event) return { kind: "none" };
  const matches = rules.filter(
    (rule) =>
      rule.event === target.event &&
      (!target.integration || rule.integration === target.integration),
  );
  const [first] = matches;
  if (!first) return { kind: "none" };
  return matches.length === 1
    ? { kind: "found", rule: first }
    : { kind: "ambiguous", rules: matches };
}
