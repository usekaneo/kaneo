import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import { formatIssueBody } from "../../github/utils/format";
import type { PluginContext, TaskDescriptionChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";

type LinkSyncState = {
  timestamp: string;
  source: string;
  value: string;
};

type LinkMetadata = {
  lastSync?: {
    description?: LinkSyncState;
  };
  [key: string]: unknown;
};

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
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
          "Failed to parse GitLab issue link metadata for description sync",
          {
            issueLinkId: issueLink.id,
            taskId: issueLink.taskId,
            metadata: issueLink.metadata,
            error,
          },
        );
      }
    }

    const lastDescSync = metadata.lastSync?.description;
    const newDescNormalized = event.newDescription || "";

    if (lastDescSync) {
      if (
        lastDescSync.value === newDescNormalized &&
        lastDescSync.source === "gitlab"
      ) {
        return;
      }

      const timeSinceLastSync =
        Date.now() - new Date(lastDescSync.timestamp).getTime();
      if (
        timeSinceLastSync < 2000 &&
        lastDescSync.source === "gitlab" &&
        newDescNormalized === lastDescSync.value
      ) {
        return;
      }
    }

    const client = createGitlabClient(config);
    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      console.warn("Skipping GitLab description sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
        taskId: issueLink.taskId,
      });
      return;
    }

    const formattedBody = formatIssueBody(event.newDescription, event.taskId);

    await client.updateIssue(config.repositoryPath, issueIid, {
      description: formattedBody,
    });

    await updateExternalLink(issueLink.id, {
      metadata: {
        ...metadata,
        lastSync: {
          ...(metadata.lastSync ?? {}),
          description: {
            timestamp: new Date().toISOString(),
            source: "kaneo",
            value: newDescNormalized,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to update GitLab issue description:", error);
  }
}
