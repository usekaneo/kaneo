import type { TFunction } from "i18next";
import type { AutomationRun } from "@/types/agent-automation";

// A short title for a run in the history list.
export function describeAutomationRun(
  trigger: AutomationRun["trigger"],
  t: TFunction,
) {
  if (!trigger || trigger.source === "manual")
    return t("agent:automations.runs.manual");
  if (trigger.source === "schedule")
    return t("agent:automations.runs.scheduled");
  const [first] = trigger.events;
  if (!first) return t("agent:automations.runs.event");
  const label = first.pullRequest
    ? `${t(`agent:automations.events.${first.event}`)} · #${first.pullRequest.number}`
    : t(`agent:automations.events.${first.event}`);
  const more = trigger.events.length - 1 + trigger.moreEvents;
  return more > 0
    ? t("agent:automations.runs.andMore", { label, count: more })
    : label;
}
