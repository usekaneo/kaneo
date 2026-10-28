import type { TaskRecurrence } from "../api/schemas.js";
import type { Frequency } from "./build-recurrence.js";

// Picking the frequency a task already repeats at, with no rule flags, means
// "keep it": rebuilding it from defaults would drop its interval, weekdays and
// time zone. Rules given on the command line are always taken as written.
export function keepCurrentRule(options: {
  readonly picked: Frequency;
  readonly current: TaskRecurrence | null;
  readonly ruleFlags: boolean;
}): TaskRecurrence | null {
  const { picked, current, ruleFlags } = options;
  return current && !ruleFlags && current.frequency === picked ? current : null;
}
