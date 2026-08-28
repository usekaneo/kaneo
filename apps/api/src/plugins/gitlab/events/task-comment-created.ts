import { findExternalLinkByTaskAndType } from "../../github/services/link-manager";
import type { PluginContext, TaskCommentCreatedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  const existingLink = await findExternalLinkByTaskAndType(
    event.taskId,
    context.integrationId,
    "issue",
  );

  if (!existingLink) {
    return;
  }

  if (!/^\d+$/.test(existingLink.externalId)) {
    console.error(
      "Skipping GitLab comment sync for invalid external issue id",
      {
        taskId: event.taskId,
        externalId: existingLink.externalId,
      },
    );
    return;
  }

  const issueIid = Number(existingLink.externalId);
  if (!Number.isFinite(issueIid) || issueIid < 1) {
    console.error("Skipping GitLab comment sync for invalid issue number", {
      taskId: event.taskId,
      externalId: existingLink.externalId,
      issueIid,
    });
    return;
  }

  try {
    await createGitlabClient(config).createIssueNote(issueIid, event.comment);
  } catch (error) {
    console.error("Failed to create GitLab comment:", error);
  }
}
