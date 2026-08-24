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
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { addLabelsToIssueGitlab } from "../utils/labels";

export async function handleTaskCreated(
  event: TaskCreatedEvent,
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

  if (existingLink) {
    return;
  }

  try {
    const client = createGitlabClient(config);
    const createdIssue = await client.createIssue(config.repositoryPath, {
      title: formatIssueTitle(event.title),
      description: formatIssueBody(event.description, event.taskId),
    });

    await createExternalLink({
      taskId: event.taskId,
      integrationId: context.integrationId,
      resourceType: "issue",
      externalId: createdIssue.iid.toString(),
      url: createdIssue.web_url,
      title: createdIssue.title,
      metadata: {
        state: createdIssue.state,
        createdFrom: "kaneo",
        lastOutboundStateSyncAt: Date.now(),
      },
    });

    const labels = getLabelsForIssue(event.priority, event.status);
    await addLabelsToIssueGitlab(config, createdIssue.iid, labels);
  } catch (error) {
    console.error("Failed to create GitLab issue:", error);
  }
}
