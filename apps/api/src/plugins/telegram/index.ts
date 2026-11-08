import type { IntegrationPlugin } from "../types";
import { validateTelegramConfig } from "./config";
import {
  handleTaskAssigneeChanged,
  handleTaskCommentCreated,
  handleTaskCreated,
  handleTaskDescriptionChanged,
  handleTaskPriorityChanged,
  handleTaskStatusChanged,
  handleTaskTitleChanged,
} from "./events";

export const telegramPlugin: IntegrationPlugin = {
  type: "telegram",
  name: "Telegram",
  onTaskCreated: handleTaskCreated,
  onTaskStatusChanged: handleTaskStatusChanged,
  onTaskPriorityChanged: handleTaskPriorityChanged,
  onTaskTitleChanged: handleTaskTitleChanged,
  onTaskDescriptionChanged: handleTaskDescriptionChanged,
  onTaskCommentCreated: handleTaskCommentCreated,
  onTaskAssigneeChanged: handleTaskAssigneeChanged,
  validateConfig: async (config) => validateTelegramConfig(config),
};
