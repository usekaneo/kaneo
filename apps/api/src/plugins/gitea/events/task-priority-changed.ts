import { findExternalLinksByTask } from "../../github/services/link-manager";
import type { PluginContext, TaskPriorityChangedEvent } from "../../types";
import { canSyncGiteaIssues, type GiteaConfig } from "../config";
import { addLabelsToIssueGitea, removeLabelGitea } from "../utils/labels";

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GiteaConfig;
  if (!canSyncGiteaIssues(config) || !config.baseUrl || !config.accessToken) {
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
    const binding = {
      integrationId: context.integrationId,
      projectId: context.projectId,
      config,
      link: issueLink,
    };

    if (event.oldPriority && event.oldPriority !== "no-priority") {
      const removed = await removeLabelGitea(
        binding,
        issueNumber,
        `priority:${event.oldPriority}`,
      );
      if (removed.outcome === "skipped") return;
    }

    if (event.newPriority && event.newPriority !== "no-priority") {
      const added = await addLabelsToIssueGitea(binding, issueNumber, [
        `priority:${event.newPriority}`,
      ]);
      if (added.outcome === "skipped") return;
    }
  } catch (error) {
    console.error("Failed to update Gitea issue priority:", error);
  }
}
