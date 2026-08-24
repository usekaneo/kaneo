import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskTitleChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";

type LinkSyncState = {
  timestamp: string;
  source: string;
  value: string;
};

type LinkMetadata = {
  lastSync?: {
    title?: LinkSyncState;
  };
  [key: string]: unknown;
};

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
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

    let metadata: LinkMetadata = {};
    if (issueLink.metadata) {
      try {
        metadata = JSON.parse(issueLink.metadata) as LinkMetadata;
      } catch (error) {
        console.warn(
          "Failed to parse GitLab issue link metadata for title sync",
          {
            issueLinkId: issueLink.id,
            taskId: issueLink.taskId,
            metadata: issueLink.metadata,
            error,
          },
        );
      }
    }

    const lastTitleSync = metadata.lastSync?.title;
    if (lastTitleSync) {
      if (
        lastTitleSync.value === event.newTitle &&
        lastTitleSync.source === "gitlab"
      ) {
        return;
      }

      const timeSinceLastSync =
        Date.now() - new Date(lastTitleSync.timestamp).getTime();
      if (lastTitleSync.source === "gitlab" && timeSinceLastSync < 2000) {
        return;
      }
    }

    const client = createGitlabClient(config);
    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      console.warn("Skipping GitLab title sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
        taskId: issueLink.taskId,
      });
      return;
    }

    await client.updateIssue(config.repositoryPath, issueIid, {
      title: event.newTitle,
    });

    await updateExternalLink(issueLink.id, {
      title: event.newTitle,
      metadata: {
        ...metadata,
        lastSync: {
          ...(metadata.lastSync ?? {}),
          title: {
            timestamp: new Date().toISOString(),
            source: "kaneo",
            value: event.newTitle,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to update GitLab issue title:", error);
  }
}
