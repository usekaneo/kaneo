import { canSyncTask } from "../../sync/eligibility";
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
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { addLabelsToIssueGitlab } from "../utils/labels";

async function createTaskIssue(
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
    if (
      !(await canSyncTask(
        event.taskId,
        context.integrationId,
        undefined,
        JSON.stringify(context.config),
      ))
    )
      return;

    const createdIssue = await client.createIssue(config.projectPath, {
      title: formatIssueTitle(event.title),
      description: formatIssueBody(event.description, event.taskId),
    });

    const createdLink = await createExternalLink({
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

    if (
      await isTaskInFinalState({
        projectId: event.projectId,
        status: event.status,
        columnId: null,
      })
    ) {
      await client.updateIssue(config.projectPath, createdIssue.iid, {
        state_event: "close",
      });
      await updateExternalLink(createdLink.id, {
        metadata: { state: "closed", lastOutboundStateSyncAt: Date.now() },
      });
    }

    await addLabelsToIssueGitlab(
      config,
      createdIssue.iid,
      await taskIssueLabels(event.taskId, event.priority, event.status),
    );
  } catch (error) {
    console.error("Failed to create GitLab issue:", error);
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
