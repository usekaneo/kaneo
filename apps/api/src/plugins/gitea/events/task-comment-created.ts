import { dispatchIssueWrite } from "../../sync/dispatch-issue-write";
import { canSyncTask } from "../../sync/eligibility";
import { findExternalLinkByTaskAndType } from "../../github/services/link-manager";
import type { PluginContext, TaskCommentCreatedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { markKaneoComment } from "../utils/comment-origin";
import { createGiteaClient } from "../utils/gitea-api";

export async function handleTaskCommentCreated(
  event: TaskCommentCreatedEvent,
  context: PluginContext,
): Promise<void> {
  if (
    !(await canSyncTask(
      event.taskId,
      context.integrationId,
      undefined,
      JSON.stringify(context.config),
    ))
  )
    return;

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
    if (!/^\d+$/.test(existingLink.externalId)) {
      console.error(
        "Skipping Gitea comment sync for invalid external issue id",
        {
          taskId: event.taskId,
          externalId: existingLink.externalId,
        },
      );
      return;
    }

    const issueNumber = Number(existingLink.externalId);

    if (!Number.isFinite(issueNumber) || issueNumber < 1) {
      console.error("Skipping Gitea comment sync for invalid issue number", {
        taskId: event.taskId,
        externalId: existingLink.externalId,
        issueNumber,
      });
      return;
    }

    await dispatchIssueWrite(existingLink, JSON.stringify(context.config), () =>
      client.createIssueComment(
        repositoryOwner,
        repositoryName,
        issueNumber,
        markKaneoComment(event.comment),
      ),
    );
  } catch (error) {
    console.error("Failed to create Gitea comment:", error);
  }
}
