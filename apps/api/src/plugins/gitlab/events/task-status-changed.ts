import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskStatusChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { updateIssueLabelsGitlab } from "../utils/labels";
import { parseLinkSyncMetadata } from "../utils/link-sync";

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
  context: PluginContext,
): Promise<void> {
  // Keep activity and other integrations informed without echoing an issue
  // webhook back to the GitLab project that produced it.
  if (event.sourceIntegrationId === context.integrationId) return;

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
      console.warn("Skipping GitLab status sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
      });
      return;
    }

    await updateIssueLabelsGitlab(config, issueIid, {
      remove: [`status:${event.oldStatus}`],
      add: [`status:${event.newStatus}`],
    });

    const closing = event.newStatus === "done";
    const reopening = event.oldStatus === "done" && event.newStatus !== "done";

    if (!closing && !reopening) {
      return;
    }

    await createGitlabClient(config).updateIssue(config.projectPath, issueIid, {
      state_event: closing ? "close" : "reopen",
    });

    await updateExternalLink(issueLink.id, {
      metadata: {
        ...parseLinkSyncMetadata(issueLink.metadata, {
          externalLinkId: issueLink.id,
          field: "state",
        }),
        state: closing ? "closed" : "opened",
        lastOutboundStateSyncAt: Date.now(),
      },
    });
  } catch (error) {
    console.error("Failed to update GitLab issue status:", error);
  }
}
