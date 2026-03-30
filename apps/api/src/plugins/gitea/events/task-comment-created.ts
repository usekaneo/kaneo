import { findExternalLinkByTaskAndType } from "../../github/services/link-manager";
import type { PluginContext, TaskCommentCreatedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GiteaConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

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
    const client = createGiteaClient(config);
    const issueNumber = Number.parseInt(existingLink.externalId, 10);

    await client.createIssueComment(
      repositoryOwner,
      repositoryName,
      issueNumber,
      event.comment,
    );
  } catch (error) {
    console.error("Failed to create Gitea comment:", error);
  }
}
