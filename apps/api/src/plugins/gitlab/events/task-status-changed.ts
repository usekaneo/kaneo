import { createIssueWrite } from "../../sync/dispatch-issue-write";
import { syncTaskFieldLabels } from "../../sync/sync-task-field-labels";
import { canSyncTask } from "../../sync/eligibility";
import { isTaskInFinalState } from "../../github/services/task-service";
import {
  findExternalLinksByTask,
  updateExternalLink,
} from "../../github/services/link-manager";
import type { PluginContext, TaskStatusChangedEvent } from "../../types";
import type { GitlabConfig } from "../config";
import { createGitlabClient } from "../utils/gitlab-api";
import { updateIssueLabelsGitlab } from "../utils/labels";
import { parseLinkSyncMetadata } from "../utils/link-sync";

export async function handleTaskStatusChanged(
  event: TaskStatusChangedEvent,
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

  // Keep activity and other integrations informed without echoing an issue
  // webhook back to the GitLab project that produced it.
  if (event.sourceIntegrationId === context.integrationId) return;

  const config = context.config as GitlabConfig;
  if (!config.baseUrl || !config.accessToken) {
    return;
  }

  try {
    const links = await findExternalLinksByTask(event.taskId);
    const issueLink = links.find(
      (link) =>
        link.integrationId === context.integrationId &&
        link.resourceType === "issue",
    );

    if (!issueLink) {
      return;
    }
    const issueIid = Number.parseInt(issueLink.externalId, 10);
    if (Number.isNaN(issueIid)) {
      console.warn("Skipping GitLab status sync for invalid issue iid", {
        issueLinkId: issueLink.id,
        externalId: issueLink.externalId,
      });
      return;
    }

    const currentValue = await syncTaskFieldLabels(
      event.taskId,
      context,
      issueLink,
      "gitlab",
      "status",
      (changes, write) =>
        updateIssueLabelsGitlab(config, issueIid, changes, true, write),
    );
    if (currentValue === undefined) return;
    const write = createIssueWrite(
      { ...issueLink, taskId: event.taskId },
      JSON.stringify(context.config),
    );

    const closing = await isTaskInFinalState({
      projectId: event.projectId,
      status: currentValue,
      columnId: null,
    });
    const reopening =
      !closing &&
      (await isTaskInFinalState({
        projectId: event.projectId,
        status: event.oldStatus,
        columnId: null,
      }));

    if (!closing && !reopening) {
      return;
    }

    await write(() =>
      createGitlabClient(config).updateIssue(config.projectPath, issueIid, {
        state_event: closing ? "close" : "reopen",
      }),
    );

    await updateExternalLink(issueLink.id, {
      metadata: {
        ...parseLinkSyncMetadata(issueLink.metadata, {
          externalLinkId: issueLink.id,
          field: "state",
        }),
        state: closing ? "closed" : "opened",
        lastOutboundStateSyncAt: Date.now(),
      },
    });
  } catch (error) {
    console.error("Failed to update GitLab issue status:", error);
  }
}
