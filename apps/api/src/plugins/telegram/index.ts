import type { IntegrationPlugin } from "../types";
import { validateTelegramConfig } from "./config";
import {
  handleTaskCommentCreated,
  handleTaskCreated,
  handleTaskDescriptionChanged,
  handleTaskPriorityChanged,
  handleTaskStatusChanged,
  handleTaskTitleChanged,
  handleTimeEntryCreated,
} from "./events";

export const telegramPlugin: IntegrationPlugin = {
  type: "telegram",
  name: "Telegram",
  onTaskCreated: handleTaskCreated,
  onTimeEntryCreated: handleTimeEntryCreated,
  onTaskStatusChanged: handleTaskStatusChanged,
  onTaskPriorityChanged: handleTaskPriorityChanged,
  onTaskTitleChanged: handleTaskTitleChanged,
  onTaskDescriptionChanged: handleTaskDescriptionChanged,
  onTaskCommentCreated: handleTaskCommentCreated,
  validateConfig: async (config) => validateTelegramConfig(config),
};
