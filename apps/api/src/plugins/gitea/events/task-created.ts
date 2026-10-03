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
import { canSyncGiteaIssues, type GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";
import { addLabelsToIssueGitea } from "../utils/labels";
import { withGiteaOutboundWrite } from "../services/outbound-fence";

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const config = context.config as GiteaConfig;
  if (!canSyncGiteaIssues(config) || !config.baseUrl || !config.accessToken) {
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
    const result = await withGiteaOutboundWrite(
      {
        integrationId: context.integrationId,
        projectId: context.projectId,
        config,
        taskId: event.taskId,
      },
      () =>
        client.createIssue(repositoryOwner, repositoryName, {
          title: formatIssueTitle(event.title),
          body: formatIssueBody(event.description, event.taskId),
        }),
    );
    if (!result.sent) return;
    const createdIssue = result.value;

    const issueLink = await createExternalLink({
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

    const labels = getLabelsForIssue(event.priority, event.status);
    const added = await addLabelsToIssueGitea(
      {
        integrationId: context.integrationId,
        projectId: context.projectId,
        config,
        link: {
          id: issueLink.id,
          taskId: event.taskId,
          externalId: createdIssue.number.toString(),
        },
      },
      createdIssue.number,
      labels,
    );
    if (added.outcome === "skipped") return;
  } catch (error) {
    console.error("Failed to create Gitea issue:", error);
  }
}
