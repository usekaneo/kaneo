import type { IntegrationPlugin } from "../types";
import { validateMattermostConfig } from "./config";
import {
  handleTaskCommentCreated,
  handleTaskCreated,
  handleTaskDescriptionChanged,
  handleTaskPriorityChanged,
  handleTaskStatusChanged,
  handleTaskTitleChanged,
  handleTimeEntryCreated,
} from "./events";

export const mattermostPlugin: IntegrationPlugin = {
  type: "mattermost",
  name: "Mattermost",
  onTaskCreated: handleTaskCreated,
  onTimeEntryCreated: handleTimeEntryCreated,
  onTaskStatusChanged: handleTaskStatusChanged,
  onTaskPriorityChanged: handleTaskPriorityChanged,
  onTaskTitleChanged: handleTaskTitleChanged,
  onTaskDescriptionChanged: handleTaskDescriptionChanged,
  onTaskCommentCreated: handleTaskCommentCreated,
  validateConfig: validateMattermostConfig,
};
