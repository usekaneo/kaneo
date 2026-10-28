import type {
  Automation,
  AutomationEventName,
  AutomationInput,
  AutomationOutput,
} from "@/types/agent-automation";

export type AutomationTriggerType = "schedule" | "event";
export type AutomationFrequency = "daily" | "weekly" | "interval";

// Form state keeps both trigger kinds so switching tabs loses nothing.
export type AutomationDraft = {
  name: string;
  prompt: string;
  triggerType: AutomationTriggerType;
  frequency: AutomationFrequency;
  time: string;
  // ISO weekdays, 1 = Monday … 7 = Sunday.
  weekdays: number[];
  intervalHours: number;
  timezone: string;
  event: AutomationEventName;
  labelName: string | null;
  columnName: string | null;
  filterProjectId: string | null;
  projectId: string | null;
  output: AutomationOutput;
  model: string | null;
  dailyRunLimit: number;
};

export const AUTOMATION_DEFAULT_DAILY_RUNS = 24;
export const AUTOMATION_MAX_DAILY_RUNS = 100;

export function createAutomationDraft(timezone: string): AutomationDraft {
  return {
    name: "",
    prompt: "",
    triggerType: "schedule",
    frequency: "weekly",
    time: "09:00",
    weekdays: [1],
    intervalHours: 4,
    timezone,
    event: "task_created",
    labelName: null,
    columnName: null,
    filterProjectId: null,
    projectId: null,
    output: "proposals",
    model: null,
    dailyRunLimit: AUTOMATION_DEFAULT_DAILY_RUNS,
  };
}

export function automationToDraft(
  automation: Automation,
  timezone: string,
): AutomationDraft {
  const draft: AutomationDraft = {
    ...createAutomationDraft(timezone),
    name: automation.name,
    prompt: automation.prompt ?? "",
    projectId: automation.projectId,
    output: automation.output,
    model: automation.model,
    dailyRunLimit: automation.dailyRunLimit,
  };
  const { trigger } = automation;
  if (trigger.type === "schedule")
    return {
      ...draft,
      triggerType: "schedule",
      frequency: trigger.frequency,
      time: trigger.time,
      weekdays: trigger.weekdays.length > 0 ? trigger.weekdays : [1],
      intervalHours: trigger.intervalHours ?? draft.intervalHours,
      timezone: trigger.timezone,
    };
  return {
    ...draft,
    triggerType: "event",
    event: trigger.event,
    labelName: trigger.filters.labelName,
    columnName: trigger.filters.columnName,
    filterProjectId: trigger.filters.projectId,
  };
}

export function draftToAutomationInput(
  draft: AutomationDraft,
): AutomationInput {
  const trigger: AutomationInput["trigger"] =
    draft.triggerType === "schedule"
      ? {
          type: "schedule",
          frequency: draft.frequency,
          time: draft.time,
          weekdays: draft.frequency === "weekly" ? draft.weekdays : [],
          intervalHours:
            draft.frequency === "interval" ? draft.intervalHours : null,
          timezone: draft.timezone,
        }
      : {
          type: "event",
          event: draft.event,
          filters: {
            labelName: draft.labelName,
            columnName: draft.columnName,
            // A project scope already limits events to that project.
            projectId: draft.projectId ? null : draft.filterProjectId,
          },
        };
  return {
    name: draft.name.trim(),
    prompt: draft.prompt.trim(),
    projectId: draft.projectId,
    output: draft.output,
    ...(draft.model ? { model: draft.model } : {}),
    trigger,
    dailyRunLimit: draft.dailyRunLimit,
  };
}
