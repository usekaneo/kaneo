import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskStatusChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { ensureLabelsExistGitlab } from "../utils/labels";

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

    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      return;
    }

    const newLabel = `status:${event.newStatus}`;
    await ensureLabelsExistGitlab(config, [newLabel]);

    const stateEvent =
      event.newStatus === "done"
        ? "close"
        : event.oldStatus === "done"
          ? "reopen"
          : null;

    // Swapping the label and moving the state in one request keeps the issue
    // from briefly carrying two status labels, which a racing status change
    // would otherwise read back as the wrong status.
    await createGitlabClient(config).updateIssue(issueIid, {
      add_labels: newLabel,
      remove_labels: `status:${event.oldStatus}`,
      ...(stateEvent ? { state_event: stateEvent } : {}),
    });

    const metadata = issueLink.metadata ? JSON.parse(issueLink.metadata) : {};

    await updateExternalLink(issueLink.id, {
      metadata: {
        ...metadata,
        ...(stateEvent
          ? {
              state: stateEvent === "close" ? "closed" : "opened",
              lastOutboundState: stateEvent === "close" ? "closed" : "opened",
              lastOutboundStateSyncAt: Date.now(),
            }
          : {}),
        lastSync: {
          ...(metadata.lastSync ?? {}),
          // Recorded so the label change this just made does not come back
          // through the issue webhook and overwrite the task's status.
          status: {
            timestamp: new Date().toISOString(),
            source: "kaneo",
            value: event.newStatus,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to update GitLab issue status:", error);
  }
}
