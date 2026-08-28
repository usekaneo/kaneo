import { findExternalLinksByTask } from "../../github/services/link-manager";
import type { PluginContext, TaskPriorityChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { ensureLabelsExistGitlab } from "../utils/labels";

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
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

    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      return;
    }

    const hasNew =
      Boolean(event.newPriority) && event.newPriority !== "no-priority";
    const hasOld =
      Boolean(event.oldPriority) && event.oldPriority !== "no-priority";

    if (!hasNew && !hasOld) {
      return;
    }

    if (hasNew) {
      await ensureLabelsExistGitlab(config, [`priority:${event.newPriority}`]);
    }

    // One request, so the issue never carries two priority labels at once.
    await createGitlabClient(config).updateIssue(issueIid, {
      ...(hasNew ? { add_labels: `priority:${event.newPriority}` } : {}),
      ...(hasOld ? { remove_labels: `priority:${event.oldPriority}` } : {}),
    });
  } catch (error) {
    console.error("Failed to update GitLab issue priority:", error);
  }
}
