import type { IntegrationPlugin } from "../types";
import { validateGitHubConfig } from "./config";
import { handleTaskCreated } from "./events/task-created";
import { handleTaskPriorityChanged } from "./events/task-priority-changed";
import { handleTaskStatusChanged } from "./events/task-status-changed";
import { setupWebhookHandlers } from "./webhook-handler";

export const githubPlugin: IntegrationPlugin = {
  type: "github",
  name: "GitHub",
  onTaskCreated: handleTaskCreated,
  onTaskStatusChanged: handleTaskStatusChanged,
  onTaskPriorityChanged: handleTaskPriorityChanged,
  validateConfig: validateGitHubConfig,
};

export function initializeGitHubPlugin() {
  setupWebhookHandlers();
}
