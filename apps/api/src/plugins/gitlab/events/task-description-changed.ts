import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import { formatIssueBody } from "../../github/utils/format";
import type { PluginContext, TaskDescriptionChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { parseIssueIid } from "../utils/issue-iid";

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
            error,
          },
        );
      }
    }

    const lastDescSync = metadata.lastSync?.description;
    const newDescNormalized = event.newDescription || "";

    // Only an identical value is the echo of what GitLab just sent us. A
    // different value is a genuine Kaneo edit and must still go out.
    if (
      lastDescSync?.source === "gitlab" &&
      lastDescSync.value === newDescNormalized &&
      Date.now() - new Date(lastDescSync.timestamp).getTime() < 2000
    ) {
      return;
    }

    const issueIid = parseIssueIid(issueLink.externalId);
    if (issueIid === null) {
      console.warn(
        "Skipping GitLab description sync for invalid issue number",
        {
          issueLinkId: issueLink.id,
          externalId: issueLink.externalId,
          taskId: issueLink.taskId,
        },
      );
      return;
    }

    await createGitlabClient(config).updateIssue(issueIid, {
      description: formatIssueBody(event.newDescription, event.taskId),
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
