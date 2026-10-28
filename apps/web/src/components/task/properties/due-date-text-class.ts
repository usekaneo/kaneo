import type { DueDateStatus } from "@/lib/due-date-status";

export const dueDateTextClass: Record<DueDateStatus, string> = {
  overdue: "text-destructive-foreground",
  "due-soon": "text-warning-foreground",
  "far-future": "",
  "no-due-date": "",
};
