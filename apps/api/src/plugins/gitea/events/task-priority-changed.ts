import { syncTaskFieldLabels } from "../../sync/sync-task-field-labels";
import { canSyncTask } from "../../sync/eligibility";
import { findExternalLinksByTask } from "../../github/services/link-manager";
import type { PluginContext, TaskPriorityChangedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { addLabelsToIssueGitea, removeLabelGitea } from "../utils/labels";

export async function handleTaskPriorityChanged(
  event: TaskPriorityChangedEvent,
  context: PluginContext,
): Promise<void> {
  if (
    !(await canSyncTask(
      event.taskId,
      context.integrationId,
      undefined,
      JSON.stringify(context.config),
    ))
  )
    return;

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

    await syncTaskFieldLabels(
      event.taskId,
      context,
      issueLink,
      "gitea",
      "priority",
      async ({ add, remove }, write) => {
        for (const name of remove)
          await removeLabelGitea(config, issueNumber, name, write, true);
        if (add.length)
          await addLabelsToIssueGitea(config, issueNumber, add, true, write);
      },
    );
  } catch (error) {
    console.error("Failed to update Gitea issue priority:", error);
  }
}
