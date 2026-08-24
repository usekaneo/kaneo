import type { IntegrationPlugin } from "../types";
import { validateMattermostConfig } from "./config";
import {
  handleTaskCommentCreated,
  handleTaskCreated,
  handleTaskDescriptionChanged,
  handleTaskPriorityChanged,
  handleTaskStatusChanged,
  handleTaskTitleChanged,
} from "./events";

export const mattermostPlugin: IntegrationPlugin = {
  type: "mattermost",
  name: "Mattermost",
  onTaskCreated: handleTaskCreated,
  onTaskStatusChanged: handleTaskStatusChanged,
  onTaskPriorityChanged: handleTaskPriorityChanged,
  onTaskTitleChanged: handleTaskTitleChanged,
  onTaskDescriptionChanged: handleTaskDescriptionChanged,
  onTaskCommentCreated: handleTaskCommentCreated,
  validateConfig: validateMattermostConfig,
};
