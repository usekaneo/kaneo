import type { IntegrationPlugin } from "../types";
import { validateGitlabConfig } from "./config";
import { handleTaskAssigneeChanged } from "./events/task-assignee-changed";
import { handleTaskCommentCreated } from "./events/task-comment-created";
import { handleTaskCreated } from "./events/task-created";
import { handleTaskDescriptionChanged } from "./events/task-description-changed";
import { handleTaskPriorityChanged } from "./events/task-priority-changed";
import { handleTaskStatusChanged } from "./events/task-status-changed";
import { handleTaskTitleChanged } from "./events/task-title-changed";
import { handleTaskUnassigned } from "./events/task-unassigned";

export const gitlabPlugin: IntegrationPlugin = {
  type: "gitlab",
  name: "GitLab",
  onTaskCreated: handleTaskCreated,
  onTaskStatusChanged: handleTaskStatusChanged,
  onTaskPriorityChanged: handleTaskPriorityChanged,
  onTaskTitleChanged: handleTaskTitleChanged,
  onTaskDescriptionChanged: handleTaskDescriptionChanged,
  onTaskCommentCreated: handleTaskCommentCreated,
  onTaskAssigneeChanged: handleTaskAssigneeChanged,
  onTaskUnassigned: handleTaskUnassigned,
  validateConfig: validateGitlabConfig,
};
