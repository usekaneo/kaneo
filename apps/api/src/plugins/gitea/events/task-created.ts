import {
  createExternalLink,
  findExternalLinkByTaskAndType,
} from "../../github/services/link-manager";
import {
  formatIssueBody,
  formatIssueTitle,
  getLabelsForIssue,
} from "../../github/utils/format";
import type { PluginContext, TaskCreatedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";
import { addLabelsToIssueGitea } from "../utils/labels";

export async function handleTaskCreated(
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

    await createExternalLink({
      taskId: event.taskId,
      integrationId: context.integrationId,
      resourceType: "issue",
      externalId: createdIssue.number.toString(),
      url: createdIssue.html_url,
      title: createdIssue.title,
      metadata: {
        state: createdIssue.state,
        createdFrom: "kaneo",
      },
    });

    const labels = getLabelsForIssue(event.priority, event.status);
    await addLabelsToIssueGitea(config, createdIssue.number, labels);
  } catch (error) {
    console.error("Failed to create Gitea issue:", error);
  }
}
