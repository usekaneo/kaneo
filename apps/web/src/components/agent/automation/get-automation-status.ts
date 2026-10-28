import type {
  AutomationPauseReason,
  AutomationSkipReason,
} from "@/types/agent-automation";

export type AutomationStatus = {
  key: string;
  tone: "muted" | "warning" | "destructive";
};

type AutomationState = {
  enabled: boolean;
  pausedReason: AutomationPauseReason | null;
  lastSkipReason: AutomationSkipReason | null;
};

// The one state worth surfacing next to an automation, or null when it is
// simply running as configured.
export function getAutomationStatus({
  enabled,
  pausedReason,
  lastSkipReason,
}: AutomationState): AutomationStatus | null {
  if (pausedReason === "owner_access")
    return {
      key: "agent:automations.status.pausedAccess",
      tone: "destructive",
    };
  if (pausedReason === "failures")
    return {
      key: "agent:automations.status.pausedFailures",
      tone: "destructive",
    };
  if (!enabled) return { key: "agent:automations.status.off", tone: "muted" };
  if (lastSkipReason === "budget")
    return { key: "agent:automations.status.budget", tone: "warning" };
  if (lastSkipReason === "daily_limit")
    return { key: "agent:automations.status.dailyLimit", tone: "warning" };
  if (lastSkipReason === "unavailable")
    return { key: "agent:automations.status.unavailable", tone: "warning" };
  if (lastSkipReason === "overlap")
    return { key: "agent:automations.status.overlap", tone: "muted" };
  return null;
}
