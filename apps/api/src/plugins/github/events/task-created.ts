import { eq } from "drizzle-orm";
import db from "../../../database";
import { projectTable } from "../../../database/schema";
import type { PluginContext, TaskCreatedEvent } from "../../types";
import type { GitHubConfig } from "../config";
import {
  createExternalLink,
  findExternalLinkByTaskAndType,
} from "../services/link-manager";
import {
  formatIssueBody,
  formatIssueTitle,
  getLabelsForIssue,
} from "../utils/format";
import { getGithubApp, getInstallationIdForRepo } from "../utils/github-app";
import { addLabelsToIssue } from "../utils/labels";

export async function handleTaskCreated(
  event: TaskCreatedEvent,
  context: PluginContext,
): Promise<void> {
  const githubApp = getGithubApp();
  if (!githubApp) {
    return;
  }

  const config = context.config as GitHubConfig;
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
    let installationId = config.installationId;
    if (!installationId) {
      installationId = await getInstallationIdForRepo(
        repositoryOwner,
        repositoryName,
      );
    }

    const octokit = await githubApp.getInstallationOctokit(installationId);

    const createdIssue = await octokit.rest.issues.create({
      owner: repositoryOwner,
      repo: repositoryName,
      title: formatIssueTitle(event.title),
      body: formatIssueBody(event.description, event.taskId),
    });

    const labels = getLabelsForIssue(event.priority, event.status);
    await addLabelsToIssue(
      octokit,
      repositoryOwner,
      repositoryName,
      createdIssue.data.number,
      labels,
    );

    await createExternalLink({
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
