import type { IntegrationPlugin } from "../types";
import { validateGenericWebhookConfig } from "./config";
import {
  handleTaskAssigneeChanged,
  handleTaskCommentCreated,
  handleTaskCreated,
  handleTaskDeleted,
  handleTaskDescriptionChanged,
  handleTaskDueDateChanged,
  handleTaskMoved,
  handleTaskPriorityChanged,
  handleTaskStatusChanged,
  handleTaskTitleChanged,
  handleTaskUnassigned,
} from "./events";

export const genericWebhookPlugin: IntegrationPlugin = {
  type: "generic-webhook",
  name: "Generic Webhook",
  onTaskCreated: handleTaskCreated,
  onTaskStatusChanged: handleTaskStatusChanged,
  onTaskPriorityChanged: handleTaskPriorityChanged,
  onTaskTitleChanged: handleTaskTitleChanged,
  onTaskDescriptionChanged: handleTaskDescriptionChanged,
  onTaskCommentCreated: handleTaskCommentCreated,
  onTaskDeleted: handleTaskDeleted,
  onTaskMoved: handleTaskMoved,
  onTaskDueDateChanged: handleTaskDueDateChanged,
  onTaskAssigneeChanged: handleTaskAssigneeChanged,
  onTaskUnassigned: handleTaskUnassigned,
  validateConfig: validateGenericWebhookConfig,
};
