import type { WorkflowRule } from "../api/workflow-rules.js";

export type RuleJson = {
  readonly id: string;
  readonly integration: string;
  readonly event: string;
  readonly column: {
    readonly id: string;
    readonly name: string | null;
    readonly slug: string | null;
  };
};

export function toRuleJson(rule: WorkflowRule): RuleJson {
  return {
    id: rule.id,
    integration: rule.integrationType,
    event: rule.eventType,
    column: { id: rule.columnId, name: rule.columnName, slug: rule.columnSlug },
  };
}
