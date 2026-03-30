import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskTitleChangedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
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

    const metadata = issueLink.metadata ? JSON.parse(issueLink.metadata) : {};

    const lastTitleSync = metadata.lastSync?.title;
    if (lastTitleSync) {
      if (
        lastTitleSync.value === event.newTitle &&
        lastTitleSync.source === "gitea"
      ) {
        console.log("Skipping title sync - already synced from Gitea");
        return;
      }

      const timeSinceLastSync =
        Date.now() - new Date(lastTitleSync.timestamp).getTime();
      if (lastTitleSync.source === "gitea" && timeSinceLastSync < 2000) {
        console.log(
          `Skipping title sync - recent sync detected (${timeSinceLastSync}ms ago)`,
        );
        return;
      }
    }

    const client = createGiteaClient(config);
    const issueNumber = Number.parseInt(issueLink.externalId, 10);

    await client.updateIssue(repositoryOwner, repositoryName, issueNumber, {
      title: event.newTitle,
    });

    await updateExternalLink(issueLink.id, {
      title: event.newTitle,
      metadata: {
        ...metadata,
        lastSync: {
          ...metadata.lastSync,
          title: {
            timestamp: new Date().toISOString(),
            source: "kaneo",
            value: event.newTitle,
          },
        },
      },
    });

    console.log(`Synced task title to Gitea issue #${issueNumber}`);
  } catch (error) {
    console.error("Failed to update Gitea issue title:", error);
  }
}
