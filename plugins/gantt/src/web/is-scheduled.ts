import type { PluginTask } from "@kaneo/plugin-sdk/web";
import { parseTaskDate } from "./timeline.js";

export function isScheduled(task: PluginTask): boolean {
  return (
    parseTaskDate(task.startDate) !== null ||
    parseTaskDate(task.dueDate) !== null
  );
}
