import { canSyncTask } from "../../sync/eligibility";
import { taskIssueLabels } from "../../sync/issue-labels";
import { withTaskSyncCreation } from "../../sync/create-task-issue";
import { eq } from "drizzle-orm";
import db from "../../../database";
import { projectTable } from "../../../database/schema";
import { isTaskInFinalState } from "../services/task-service";
import type { PluginContext, TaskCreatedEvent } from "../../types";
import { type GitHubConfig, hasVerifiedGitHubBinding } from "../config";
import {
  createExternalLink,
  updateExternalLink,
  findExternalLinkByTaskAndType,
} from "../services/link-manager";
import { formatIssueBody, formatIssueTitle } from "../utils/format";
import {
  getGithubApp,
  getVerifiedInstallationOctokit,
} from "../utils/github-app";
import { addLabelsToIssue } from "../utils/labels";

async function createTaskIssue(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const githubApp = getGithubApp();
  if (!githubApp) {
    return;
  }

  const config = context.config as GitHubConfig;
  if (!hasVerifiedGitHubBinding(config)) return;
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
    const octokit = await getVerifiedInstallationOctokit(config);

    if (
      !(await canSyncTask(
        event.taskId,
        context.integrationId,
        undefined,
        JSON.stringify(context.config),
      ))
    )
      return;

    const createdIssue = await octokit.rest.issues.create({
      owner: repositoryOwner,
      repo: repositoryName,
      title: formatIssueTitle(event.title),
      body: formatIssueBody(event.description, event.taskId),
    });

    const createdLink = await createExternalLink({
      taskId: event.taskId,
      integrationId: context.integrationId,
      resourceType: "issue",
      externalId: createdIssue.data.number.toString(),
      url: createdIssue.data.html_url,
      title: createdIssue.data.title,
      metadata: {
        state: createdIssue.data.state,
        createdFrom: "kaneo",
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
      await octokit.rest.issues.update({
        owner: repositoryOwner,
        repo: repositoryName,
        issue_number: createdIssue.data.number,
        state: "closed",
      });
      await updateExternalLink(createdLink.id, {
        metadata: { state: "closed", lastOutboundStateSyncAt: Date.now() },
      });
    }

    const labels = await taskIssueLabels(
      event.taskId,
      event.priority,
      event.status,
    );
    await addLabelsToIssue(
      octokit,
      repositoryOwner,
      repositoryName,
      createdIssue.data.number,
      labels,
    );

    if (config.commentTaskLinkOnGitHubIssue !== false) {
      const project = await db.query.projectTable.findFirst({
        where: eq(projectTable.id, event.projectId),
      });

      if (project) {
        const clientUrl =
          process.env.KANEO_CLIENT_URL || "http://localhost:5173";
        const taskUrl = `${clientUrl}/dashboard/workspace/${project.workspaceId}/project/${event.projectId}/task/${event.taskId}`;
        const taskIdentifier = `${project.slug.toUpperCase()}-${event.number}`;

        await octokit.rest.issues.createComment({
          owner: repositoryOwner,
          repo: repositoryName,
          issue_number: createdIssue.data.number,
          body: `[${taskIdentifier}](${taskUrl})`,
        });
      }
    }
  } catch (error) {
    console.error("Failed to create GitHub issue:", error);
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
