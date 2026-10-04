import {
  initializeTaskIssue,
  isIssueInitializationPending,
} from "../../sync/initialize-task-issue";
import { canSyncTask } from "../../sync/eligibility";
import { withTaskSyncCreation } from "../../sync/create-task-issue";
import { syncTaskFieldLabels } from "../../sync/sync-task-field-labels";
import {
  createExternalLink,
  updateExternalLink,
  findExternalLinkByTaskAndType,
} from "../../github/services/link-manager";
import { formatIssueBody, formatIssueTitle } from "../../github/utils/format";
import type { PluginContext, TaskCreatedEvent } from "../../types";
import type { GiteaConfig } from "../config";
import { createGiteaClient } from "../utils/gitea-api";
import { addLabelsToIssueGitea, removeLabelGitea } from "../utils/labels";

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

  if (existingLink && !isIssueInitializationPending(existingLink)) return;

  try {
    const client = createGiteaClient(config);
    if (
      !(await canSyncTask(
        event.taskId,
        context.integrationId,
        undefined,
        JSON.stringify(context.config),
      ))
    )
      return;

    let createdLink: { id: string; metadata?: string | null } | undefined =
      existingLink;
    let issueNumber = existingLink ? Number(existingLink.externalId) : 0;
    if (!existingLink) {
      const createdIssue = await client.createIssue(
        repositoryOwner,
        repositoryName,
        {
          title: formatIssueTitle(event.title),
          body: formatIssueBody(event.description, event.taskId),
        },
      );

      createdLink = await createExternalLink({
        taskId: event.taskId,
        integrationId: context.integrationId,
        resourceType: "issue",
        externalId: createdIssue.number.toString(),
        url: createdIssue.html_url,
        title: createdIssue.title,
        metadata: {
          state: createdIssue.state,
          createdFrom: "kaneo",
          syncInitializationPending: true,
          syncCreatedText: {
            title: event.title,
            description: event.description ?? "",
          },
          lastOutboundStateSyncAt: Date.now(),
        },
      });
      issueNumber = createdIssue.number;
    }
    if (!createdLink) return;

    if (
      !(await canSyncTask(
        event.taskId,
        context.integrationId,
        undefined,
        JSON.stringify(context.config),
      ))
    ) {
      await updateExternalLink(createdLink.id, {
        metadata: { syncFilterPaused: true },
      });
      return;
    }

    await initializeTaskIssue(event, context, createdLink, {
      text: async (field, value) =>
        (
          await client.updateIssue(
            repositoryOwner,
            repositoryName,
            issueNumber,
            field === "title"
              ? { title: formatIssueTitle(value) }
              : { body: formatIssueBody(value, event.taskId) },
          )
        )?.updated_at,
      state: async (value) =>
        (
          await client.updateIssue(
            repositoryOwner,
            repositoryName,
            issueNumber,
            {
              state: value === "closed" ? "closed" : "open",
            },
          )
        )?.updated_at,
      labels: () =>
        syncTaskFieldLabels(
          event.taskId,
          context,
          { id: createdLink.id, externalId: String(issueNumber) },
          "gitea",
          "initialization",
          async ({ add, remove }, write) => {
            for (const name of remove)
              await removeLabelGitea(config, issueNumber, name, write, true);
            await addLabelsToIssueGitea(config, issueNumber, add, true, write);
          },
        ),
    });
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
