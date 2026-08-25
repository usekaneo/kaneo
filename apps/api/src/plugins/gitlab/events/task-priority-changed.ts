import { findExternalLinksByTask } from "../../github/services/link-manager";
import type { PluginContext, TaskPriorityChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { addLabelsToIssueGitlab, removeLabelGitlab } from "../utils/labels";

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
      console.warn("Skipping GitLab priority sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
        taskId: issueLink.taskId,
      });
      return;
    }

    if (event.oldPriority && event.oldPriority !== "no-priority") {
      await removeLabelGitlab(
        config,
        issueIid,
        `priority:${event.oldPriority}`,
      );
    }

    if (event.newPriority && event.newPriority !== "no-priority") {
      await addLabelsToIssueGitlab(config, issueIid, [
        `priority:${event.newPriority}`,
      ]);
    }
  } catch (error) {
    console.error("Failed to update GitLab issue priority:", error);
  }
}
