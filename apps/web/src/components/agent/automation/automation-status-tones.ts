import type { AutomationStatus } from "./get-automation-status";

export const AUTOMATION_STATUS_TONES: Record<AutomationStatus["tone"], string> =
  {
    muted: "text-muted-foreground",
    warning: "text-warning-foreground",
    destructive: "text-destructive-foreground",
  };
