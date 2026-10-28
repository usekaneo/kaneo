import type { TFunction } from "i18next";
import { REPOSITORY_PROVIDERS } from "@/components/project/automations/repository-providers";
import type { AutomationRuleListItem } from "@/types/agent-automation";

// Workflow rules move a task's card when a repository event arrives.
export function describeWorkflowRule(
  rule: Pick<
    AutomationRuleListItem,
    "columnName" | "eventType" | "integrationType"
  >,
  t: TFunction,
) {
  const event = t(`settings:workflowEditor.events.${rule.eventType}`, {
    defaultValue: rule.eventType,
  });
  const provider =
    REPOSITORY_PROVIDERS.find(({ id }) => id === rule.integrationType)?.name ??
    rule.integrationType;
  return {
    title: rule.columnName
      ? t(`agent:automations.rule.when.${rule.eventType}`, {
          column: rule.columnName,
          defaultValue: t("agent:automations.rule.moveTo", {
            column: rule.columnName,
          }),
        })
      : event,
    detail: `${event} · ${provider}`,
  };
}
