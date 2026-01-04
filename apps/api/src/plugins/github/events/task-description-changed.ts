import type { PluginContext, TaskDescriptionChangedEvent } from "../../types";
import type { GitHubConfig } from "../config";
import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../services/link-manager";
import { formatIssueBody } from "../utils/format";
import { getGithubApp, getInstallationIdForRepo } from "../utils/github-app";

export async function handleTaskDescriptionChanged(
  event: TaskDescriptionChangedEvent,
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
    const lastDescSync = metadata.lastSync?.description;
    const newDescNormalized = event.newDescription || "";

    if (lastDescSync) {
      // Skip if value unchanged and last sync was from GitHub
      if (
        lastDescSync.value === newDescNormalized &&
        lastDescSync.source === "github"
      ) {
        console.log("Skipping description sync - already synced from GitHub");
        return;
      }

      // Skip if recent sync (within 2 seconds) to prevent rapid loops
      const timeSinceLastSync =
        Date.now() - new Date(lastDescSync.timestamp).getTime();
      if (timeSinceLastSync < 2000) {
        console.log(
          `Skipping description sync - recent sync detected (${timeSinceLastSync}ms ago)`,
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

    // Format description with task ID footer
    const formattedBody = formatIssueBody(event.newDescription, event.taskId);

    await octokit.rest.issues.update({
      owner: repositoryOwner,
      repo: repositoryName,
      issue_number: issueNumber,
      body: formattedBody,
    });

    // Update metadata to track this sync
    await updateExternalLink(issueLink.id, {
      metadata: {
        ...metadata,
        lastSync: {
          ...metadata.lastSync,
          description: {
            timestamp: new Date().toISOString(),
            source: "kaneo",
            value: newDescNormalized,
          },
        },
      },
    });

    console.log(`Synced task description to GitHub issue #${issueNumber}`);
  } catch (error) {
    console.error("Failed to update GitHub issue description:", error);
  }
}
