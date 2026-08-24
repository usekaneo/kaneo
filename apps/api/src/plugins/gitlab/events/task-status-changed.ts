import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskStatusChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { addLabelsToIssueGitlab, removeLabelGitlab } from "../utils/labels";

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
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

    const client = createGitlabClient(config);
    const issueIid = Number.parseInt(issueLink.externalId, 10);

    await removeLabelGitlab(config, issueIid, `status:${event.oldStatus}`);

    await addLabelsToIssueGitlab(config, issueIid, [
      `status:${event.newStatus}`,
    ]);

    // GitLab's issue `state` is read-only on update — closing/reopening
    // goes through the state_event action field instead.
    if (event.newStatus === "done") {
      await client.updateIssue(config.repositoryPath, issueIid, {
        state_event: "close",
      });

      await updateExternalLink(issueLink.id, {
        metadata: {
          ...(issueLink.metadata ? JSON.parse(issueLink.metadata) : {}),
          state: "closed",
          lastOutboundStateSyncAt: Date.now(),
        },
      });
    } else if (event.oldStatus === "done" && event.newStatus !== "done") {
      await client.updateIssue(config.repositoryPath, issueIid, {
        state_event: "reopen",
      });

      await updateExternalLink(issueLink.id, {
        metadata: {
          ...(issueLink.metadata ? JSON.parse(issueLink.metadata) : {}),
          state: "opened",
          lastOutboundStateSyncAt: Date.now(),
        },
      });
    }
  } catch (error) {
    console.error("Failed to update GitLab issue status:", error);
  }
}
