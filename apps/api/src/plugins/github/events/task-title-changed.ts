import type { PluginContext, TaskTitleChangedEvent } from "../../types";
import type { GitHubConfig } from "../config";
import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../services/link-manager";
import { getGithubApp, getInstallationIdForRepo } from "../utils/github-app";

export async function handleTaskTitleChanged(
  event: TaskTitleChangedEvent,
  context: PluginContext,
): Promise<void> {
  const githubApp = getGithubApp();
  if (!githubApp) {
    return;
  }

  const config = context.config as GitHubConfig;
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

    // LOOP PREVENTION: Check if this update originated from GitHub
    const lastTitleSync = metadata.lastSync?.title;
    if (lastTitleSync) {
      // Skip if value unchanged and last sync was from GitHub
      if (
        lastTitleSync.value === event.newTitle &&
        lastTitleSync.source === "github"
      ) {
        console.log("Skipping title sync - already synced from GitHub");
        return;
      }

      // Skip if recent sync (within 2 seconds) to prevent rapid loops
      const timeSinceLastSync =
        Date.now() - new Date(lastTitleSync.timestamp).getTime();
      if (timeSinceLastSync < 2000) {
        console.log(
          `Skipping title sync - recent sync detected (${timeSinceLastSync}ms ago)`,
        );
        return;
      }
    }

    let installationId = config.installationId;
    if (!installationId) {
      installationId = await getInstallationIdForRepo(
        repositoryOwner,
        repositoryName,
      );
    }

    const octokit = await githubApp.getInstallationOctokit(installationId);
    const issueNumber = Number.parseInt(issueLink.externalId, 10);

    await octokit.rest.issues.update({
      owner: repositoryOwner,
      repo: repositoryName,
      issue_number: issueNumber,
      title: event.newTitle,
    });

    // Update metadata to track this sync
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

    console.log(`Synced task title to GitHub issue #${issueNumber}`);
  } catch (error) {
    console.error("Failed to update GitHub issue title:", error);
  }
}
