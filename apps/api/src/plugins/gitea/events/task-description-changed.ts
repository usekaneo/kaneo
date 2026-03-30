import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import { formatIssueBody } from "../../github/utils/format";
import type { PluginContext, TaskDescriptionChangedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";

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
  const config = context.config as GiteaConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  const { repositoryOwner, repositoryName } = config;

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
          "Failed to parse Gitea issue link metadata for description sync",
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
        lastDescSync.source === "gitea"
      ) {
        console.log("Skipping description sync - already synced from Gitea");
        return;
      }

      const timeSinceLastSync =
        Date.now() - new Date(lastDescSync.timestamp).getTime();
      if (
        timeSinceLastSync < 2000 &&
        lastDescSync.source !== "kaneo" &&
        newDescNormalized === lastDescSync.value
      ) {
        console.log(
          `Skipping description sync - recent sync detected (${timeSinceLastSync}ms ago)`,
        );
        return;
      }
    }

    const client = createGiteaClient(config);
    const issueNumber = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueNumber)) {
      console.warn("Skipping Gitea description sync for invalid issue number", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
        taskId: issueLink.taskId,
      });
      return;
    }

    const formattedBody = formatIssueBody(event.newDescription, event.taskId);

    await client.updateIssue(repositoryOwner, repositoryName, issueNumber, {
      body: formattedBody,
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

    console.log(`Synced task description to Gitea issue #${issueNumber}`);
  } catch (error) {
    console.error("Failed to update Gitea issue description:", error);
  }
}
