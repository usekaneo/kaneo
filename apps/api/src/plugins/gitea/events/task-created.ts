import { taskIssueLabels } from "../../sync/issue-labels";
import { withTaskSyncCreation } from "../../sync/create-task-issue";
import {
  createExternalLink,
  updateExternalLink,
  findExternalLinkByTaskAndType,
} from "../../github/services/link-manager";
import { formatIssueBody, formatIssueTitle } from "../../github/utils/format";
import { isTaskInFinalState } from "../../github/services/task-service";
import type { PluginContext, TaskCreatedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";
import { addLabelsToIssueGitea } from "../utils/labels";

async function createTaskIssue(
  event: TaskCreatedEvent,
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

  if (existingLink) {
    return;
  }

  try {
    const client = createGiteaClient(config);
    const createdIssue = await client.createIssue(
      repositoryOwner,
      repositoryName,
      {
        title: formatIssueTitle(event.title),
        body: formatIssueBody(event.description, event.taskId),
      },
    );

    const createdLink = await createExternalLink({
      taskId: event.taskId,
      integrationId: context.integrationId,
      resourceType: "issue",
      externalId: createdIssue.number.toString(),
      url: createdIssue.html_url,
      title: createdIssue.title,
      metadata: {
        state: createdIssue.state,
        createdFrom: "kaneo",
        lastOutboundStateSyncAt: Date.now(),
      },
    });

    if (
      await isTaskInFinalState({
        projectId: event.projectId,
        status: event.status,
        columnId: null,
      })
    ) {
      await client.updateIssue(
        repositoryOwner,
        repositoryName,
        createdIssue.number,
        { state: "closed" },
      );
      await updateExternalLink(createdLink.id, {
        metadata: { state: "closed", lastOutboundStateSyncAt: Date.now() },
      });
    }

    const labels = await taskIssueLabels(
      event.taskId,
      event.priority,
      event.status,
    );
    await addLabelsToIssueGitea(config, createdIssue.number, labels);
  } catch (error) {
    console.error("Failed to create Gitea issue:", error);
  }
}

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  await withTaskSyncCreation(event, context, (current) =>
    createTaskIssue(current, context),
  );
}
