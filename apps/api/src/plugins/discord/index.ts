import type { IntegrationPlugin } from "../types";
import { validateDiscordConfig } from "./config";
import {
  handleTaskCommentCreated,
  handleTaskCreated,
  handleTaskDescriptionChanged,
  handleTaskPriorityChanged,
  handleTaskStatusChanged,
  handleTaskTitleChanged,
  handleTimeEntryCreated,
} from "./events";

export const discordPlugin: IntegrationPlugin = {
  type: "discord",
  name: "Discord",
  onTaskCreated: handleTaskCreated,
  onTimeEntryCreated: handleTimeEntryCreated,
  onTaskStatusChanged: handleTaskStatusChanged,
  onTaskPriorityChanged: handleTaskPriorityChanged,
  onTaskTitleChanged: handleTaskTitleChanged,
  onTaskDescriptionChanged: handleTaskDescriptionChanged,
  onTaskCommentCreated: handleTaskCommentCreated,
  validateConfig: validateDiscordConfig,
};
