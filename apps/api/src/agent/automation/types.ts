export const AUTOMATION_EVENTS = [
  "task_created",
  "task_moved",
  "due_date_passed",
  "pr_opened",
  "pr_merged",
  "comment_added",
] as const;
export type AutomationEventName = (typeof AUTOMATION_EVENTS)[number];

export const AUTOMATION_OUTPUTS = ["proposals", "digest"] as const;
export type AutomationOutput = (typeof AUTOMATION_OUTPUTS)[number];

export type AutomationSchedule = {
  type: "schedule";
  frequency: "daily" | "weekly" | "interval";
  // Local wall-clock time "HH:MM" in `timezone`; unused for intervals.
  time: string;
  // ISO weekdays, 1 = Monday … 7 = Sunday; used by weekly schedules.
  weekdays: number[];
  intervalHours: number | null;
  timezone: string;
};

export type AutomationEventFilters = {
  labelName: string | null;
  columnName: string | null;
  projectId: string | null;
};

export type AutomationEventTrigger = {
  type: "event";
  event: AutomationEventName;
  filters: AutomationEventFilters;
};

export type AutomationTrigger = AutomationSchedule | AutomationEventTrigger;

export const AUTOMATION_PAUSE_REASONS = ["owner_access", "failures"] as const;
export type AutomationPauseReason = (typeof AUTOMATION_PAUSE_REASONS)[number];

export const AUTOMATION_SKIP_REASONS = [
  "budget",
  "daily_limit",
  "overlap",
  "unavailable",
] as const;
export type AutomationSkipReason = (typeof AUTOMATION_SKIP_REASONS)[number];

// A triggering event as stored for a run. Text fields are snapshots of
// workspace content and stay untrusted data.
export type AutomationEventRef = {
  event: AutomationEventName;
  taskId: string;
  projectId: string;
  occurredAt: string;
  actorName: string | null;
  columnName: string | null;
  pullRequest: { number: number; title: string; url: string } | null;
  commentPreview: string | null;
};

export type AgentRunTrigger = {
  automationId: string;
  source: "schedule" | "event" | "manual";
  output: AutomationOutput;
  scheduledFor: string | null;
  events: AutomationEventRef[];
  // Events beyond the listed ones in the same batch.
  moreEvents: number;
};
