import type { PluginContext, TaskCommentCreatedEvent } from "../../types";
import type { GitHubConfig } from "../config";
import { findExternalLinkByTaskAndType } from "../services/link-manager";
import { getOctokitForConfig } from "../utils/octokit-for-config";

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
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
    const octokit = await getOctokitForConfig(config);

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
