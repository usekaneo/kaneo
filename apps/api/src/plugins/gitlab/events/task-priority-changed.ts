import { createIssueWrite } from "../../sync/dispatch-issue-write";
import { canSyncTask } from "../../sync/eligibility";
import { findExternalLinksByTask } from "../../github/services/link-manager";
import type { PluginContext, TaskPriorityChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { updateIssueLabelsGitlab } from "../utils/labels";

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
    const write = createIssueWrite(
      { ...issueLink, taskId: event.taskId },
      JSON.stringify(context.config),
    );

    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      return;
    }

    const remove =
      event.oldPriority && event.oldPriority !== "no-priority"
        ? [`priority:${event.oldPriority}`]
        : [];
    const add =
      event.newPriority && event.newPriority !== "no-priority"
        ? [`priority:${event.newPriority}`]
        : [];

    await updateIssueLabelsGitlab(
      config,
      issueIid,
      { add, remove },
      false,
      write,
    );
  } catch (error) {
    console.error("Failed to update GitLab issue priority:", error);
  }
}
