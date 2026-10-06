import { syncTaskFieldLabels } from "../../sync/sync-task-field-labels";
import { canSyncTask } from "../../sync/eligibility";
import { syncLatestTaskValue } from "../services/sync-latest-task-value";
import { isTaskInFinalState } from "../services/task-service";
import type { PluginContext, TaskStatusChangedEvent } from "../../types";
import { type GitHubConfig, hasVerifiedGitHubBinding } from "../config";
import { findExternalLinksByTask } from "../services/link-manager";
import {
  getGithubApp,
  getVerifiedInstallationOctokit,
} from "../utils/github-app";
import { addLabelsToIssue, removeLabel } from "../utils/labels";

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

  const githubApp = getGithubApp();
  if (!githubApp) {
    return;
  }

  const config = context.config as GitHubConfig;
  if (!hasVerifiedGitHubBinding(config)) return;
  const { repositoryOwner, repositoryName } = config;

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
    const octokit = await getVerifiedInstallationOctokit(config);
    const issueNumber = Number.parseInt(issueLink.externalId, 10);

    const currentValue = await syncTaskFieldLabels(
      event.taskId,
      context,
      issueLink,
      "github",
      "status",
      async ({ add, remove }, write) => {
        for (const name of remove)
          await removeLabel(
            octokit,
            repositoryOwner,
            repositoryName,
            issueNumber,
            name,
            write,
          );
        if (add.length)
          await addLabelsToIssue(
            octokit,
            repositoryOwner,
            repositoryName,
            issueNumber,
            add,
            true,
            write,
          );
      },
    );
    if (currentValue === undefined) return;
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
    if (closing || reopening) {
      await syncLatestTaskValue(
        event.taskId,
        event.projectId,
        issueLink,
        "state",
        closing ? "closed" : "open",
        async (value) => {
          const response = await octokit.rest.issues.update({
            owner: repositoryOwner,
            repo: repositoryName,
            issue_number: issueNumber,
            state: value === "closed" ? "closed" : "open",
          });
          return response?.data?.updated_at;
        },
        async () =>
          (
            await octokit.rest.issues.get({
              owner: repositoryOwner,
              repo: repositoryName,
              issue_number: issueNumber,
            })
          ).data.state ?? "open",
        { type: "github", config: JSON.stringify(config) },
      );
    }
  } catch (error) {
    console.error("Failed to update GitHub issue status:", error);
  }
}
