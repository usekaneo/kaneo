import type { PluginContext, TaskCommentCreatedEvent } from "../../types";
import type { GitHubConfig } from "../config";
import { findExternalLinkByTaskAndType } from "../services/link-manager";
import { getGithubApp, getInstallationIdForRepo } from "../utils/github-app";

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const githubApp = getGithubApp();
  if (!githubApp) {
    return;
  }

  const config = context.config as GitHubConfig;
  const { repositoryOwner, repositoryName } = config;

  const existingLink = await findExternalLinkByTaskAndType(
    event.taskId,
    context.integrationId,
    "issue",
  );

  if (!existingLink) {
    return;
  }

  try {
    let installationId = config.installationId;
    if (!installationId) {
      installationId = await getInstallationIdForRepo(
        repositoryOwner,
        repositoryName,
      );
    }

    const octokit = await githubApp.getInstallationOctokit(installationId);

    const issueNumber = Number.parseInt(existingLink.externalId, 10);

    await octokit.rest.issues.createComment({
      owner: repositoryOwner,
      repo: repositoryName,
      issue_number: issueNumber,
      body: event.comment,
    });
  } catch (error) {
    console.error("Failed to create GitHub comment:", error);
  }
}
