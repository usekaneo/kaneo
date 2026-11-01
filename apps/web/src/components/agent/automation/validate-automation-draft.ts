import { getAgentMentionRefs } from "../mention/agent-mention-token";
import {
  AUTOMATION_MAX_DAILY_RUNS,
  type AutomationDraft,
} from "./automation-draft";

// The API's limits for automation prompts and names.
const MAX_NAME_LENGTH = 200;
const MAX_PROMPT_LENGTH = 16000;
const MENTION_LIMIT = 10;

export type AutomationDraftField =
  | "name"
  | "prompt"
  | "time"
  | "weekdays"
  | "intervalHours"
  | "dailyRunLimit";

// Maps each invalid field to an i18n key.
export type AutomationDraftErrors = Partial<
  Record<AutomationDraftField, string>
>;

const isIntegerIn = (value: number, min: number, max: number) =>
  Number.isInteger(value) && value >= min && value <= max;

export function validateAutomationDraft(
  draft: AutomationDraft,
): AutomationDraftErrors {
  const errors: AutomationDraftErrors = {};
  const name = draft.name.trim();
  const prompt = draft.prompt.trim();

  if (!name) errors.name = "agent:automations.form.errors.nameRequired";
  else if (name.length > MAX_NAME_LENGTH)
    errors.name = "agent:automations.form.errors.nameTooLong";

  if (!prompt) errors.prompt = "agent:automations.form.errors.promptRequired";
  else if (prompt.length > MAX_PROMPT_LENGTH)
    errors.prompt = "agent:automations.form.errors.promptTooLong";
  else if (getAgentMentionRefs(prompt).length > MENTION_LIMIT)
    errors.prompt = "agent:automations.form.errors.tooManyMentions";

  if (draft.triggerType === "schedule") {
    if (
      draft.frequency !== "interval" &&
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(draft.time)
    )
      errors.time = "agent:automations.form.errors.time";
    if (draft.frequency === "weekly" && draft.weekdays.length === 0)
      errors.weekdays = "agent:automations.form.errors.weekdays";
    if (
      draft.frequency === "interval" &&
      !isIntegerIn(draft.intervalHours, 1, 24)
    )
      errors.intervalHours = "agent:automations.form.errors.intervalHours";
  }

  if (!isIntegerIn(draft.dailyRunLimit, 1, AUTOMATION_MAX_DAILY_RUNS))
    errors.dailyRunLimit = "agent:automations.form.errors.dailyRunLimit";

  return errors;
}
