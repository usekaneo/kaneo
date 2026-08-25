import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskUnassignedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";

type LinkSyncState = {
  timestamp: string;
  source: string;
  value: string;
};

type LinkMetadata = {
  lastSync?: {
    assignee?: LinkSyncState;
  };
  [key: string]: unknown;
};

export async function handleTaskUnassigned(
  event: TaskUnassignedEvent,
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
          "Failed to parse GitLab issue link metadata for unassign sync",
          {
            issueLinkId: issueLink.id,
            taskId: issueLink.taskId,
            metadata: issueLink.metadata,
            error,
          },
        );
      }
    }

    const lastAssigneeSync = metadata.lastSync?.assignee;
    if (lastAssigneeSync) {
      if (
        lastAssigneeSync.value === "" &&
        lastAssigneeSync.source === "gitlab"
      ) {
        return;
      }

      const timeSinceLastSync =
        Date.now() - new Date(lastAssigneeSync.timestamp).getTime();
      if (
        timeSinceLastSync < 2000 &&
        lastAssigneeSync.source === "gitlab" &&
        lastAssigneeSync.value === ""
      ) {
        return;
      }
    }

    const client = createGitlabClient(config);
    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      console.warn("Skipping GitLab unassign sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
        taskId: issueLink.taskId,
      });
      return;
    }

    // In GitLab REST API, passing [0] unassigns all assignees from the issue
    await client.updateIssue(config.repositoryPath, issueIid, {
      assignee_ids: [0],
    });

    await updateExternalLink(issueLink.id, {
      metadata: {
        ...metadata,
        lastSync: {
          ...(metadata.lastSync ?? {}),
          assignee: {
            timestamp: new Date().toISOString(),
            source: "kaneo",
            value: "",
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to unassign GitLab issue:", error);
  }
}
