import { eq } from "drizzle-orm";
import db from "../../../database";
import { userTable } from "../../../database/schema";
import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskAssigneeChangedEvent } from "../../types";
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

export async function handleTaskAssigneeChanged(
  event: TaskAssigneeChangedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken || !event.newAssigneeId) {
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

    const assignedUser = await db.query.userTable.findFirst({
      where: eq(userTable.id, event.newAssigneeId),
    });

    if (!assignedUser?.email) {
      return;
    }

    let metadata: LinkMetadata = {};
    if (issueLink.metadata) {
      try {
        metadata = JSON.parse(issueLink.metadata) as LinkMetadata;
      } catch (error) {
        console.warn(
          "Failed to parse GitLab issue link metadata for assignee sync",
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
    const userEmailNormalized = assignedUser.email.toLowerCase();

    if (lastAssigneeSync) {
      if (
        lastAssigneeSync.value.toLowerCase() === userEmailNormalized &&
        lastAssigneeSync.source === "gitlab"
      ) {
        return;
      }

      const timeSinceLastSync =
        Date.now() - new Date(lastAssigneeSync.timestamp).getTime();
      if (
        timeSinceLastSync < 2000 &&
        lastAssigneeSync.source === "gitlab" &&
        lastAssigneeSync.value.toLowerCase() === userEmailNormalized
      ) {
        return;
      }
    }

    const client = createGitlabClient(config);
    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      console.warn("Skipping GitLab assignee sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
        taskId: issueLink.taskId,
      });
      return;
    }

    const gitlabUser = await client.findUserByEmail(
      assignedUser.email,
      config.repositoryPath,
    );

    if (!gitlabUser) {
      console.warn("Could not find matching GitLab user for email", {
        email: assignedUser.email,
        repositoryPath: config.repositoryPath,
      });
      return;
    }

    await client.updateIssue(config.repositoryPath, issueIid, {
      assignee_ids: [gitlabUser.id],
    });

    await updateExternalLink(issueLink.id, {
      metadata: {
        ...metadata,
        lastSync: {
          ...(metadata.lastSync ?? {}),
          assignee: {
            timestamp: new Date().toISOString(),
            source: "kaneo",
            value: assignedUser.email,
          },
        },
      },
    });
  } catch (error) {
    console.error("Failed to update GitLab issue assignee:", error);
  }
}
