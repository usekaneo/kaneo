import { findExternalLinksByTask } from "../../github/services/link-manager";
import type { PluginContext, TaskPriorityChangedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { addLabelsToIssueGitea, removeLabelGitea } from "../utils/labels";

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GiteaConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  try {
    const links = await findExternalLinksByTask(event.taskId);
    const issueLink = links.find(
      (link) =>
        link.integrationId === context.integrationId &&
        link.resourceType === "issue",
    );

    if (!issueLink) {
      return;
    }

    const issueNumber = Number.parseInt(issueLink.externalId, 10);

    if (event.oldPriority && event.oldPriority !== "no-priority") {
      await removeLabelGitea(
        config,
        issueNumber,
        `priority:${event.oldPriority}`,
      );
    }

    if (event.newPriority && event.newPriority !== "no-priority") {
      await addLabelsToIssueGitea(config, issueNumber, [
        `priority:${event.newPriority}`,
      ]);
    }
  } catch (error) {
    console.error("Failed to update Gitea issue priority:", error);
  }
}
