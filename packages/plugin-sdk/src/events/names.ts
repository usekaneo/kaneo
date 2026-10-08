import type { PluginEventName } from "./types.js";

export const PLUGIN_EVENT_NAMES = [
  "task.created",
  "task.status_changed",
  "task.priority_changed",
  "task.title_changed",
  "task.description_changed",
  "task.due_date_changed",
  "task.assignee_changed",
  "task.moved",
  "task.deleted",
  "comment.created",
] as const satisfies readonly PluginEventName[];
