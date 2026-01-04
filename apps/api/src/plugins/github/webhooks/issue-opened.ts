import { eq } from "drizzle-orm";
import db from "../../../database";
import { projectTable, taskTable } from "../../../database/schema";
import getNextTaskNumber from "../../../task/controllers/get-next-task-number";
import type { GitHubConfig } from "../config";
import { createExternalLink, findExternalLink } from "../services/link-manager";
import { findIntegrationByRepo } from "../services/task-service";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../utils/format";
import { getGithubApp } from "../utils/github-app";
import { addLabelsToIssue } from "../utils/labels";

type IssueOpenedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    labels?: Array<string | { name?: string }>;
    user: { login: string } | null;
  };
  repository: {
    owner: { login: string };
    name: string;
    full_name: string;
  };
};

export async function handleIssueOpened(payload: IssueOpenedPayload) {
  const githubApp = getGithubApp();
  if (!githubApp) {
    return;
  }

  const { issue, repository } = payload;

  const integration = await findIntegrationByRepo(
    repository.owner.login,
    repository.name,
  );

  if (!integration) {
    return;
  }

  const config = JSON.parse(integration.config) as GitHubConfig;
  const projectId = integration.projectId;

  const priority = extractIssuePriority(issue.labels);
  const status = extractIssueStatus(issue.labels);

  const existingLink = await findExternalLink(
    integration.id,
    "issue",
    issue.number.toString(),
  );

  if (existingLink) {
    console.log(
      `Issue #${issue.number} already linked to task ${existingLink.taskId}, skipping creation`,
    );
    return;
  }

  const nextTaskNumber = await getNextTaskNumber(projectId);

  const taskValues: typeof taskTable.$inferInsert = {
    projectId,
    userId: null,
    title: issue.title,
    description: formatTaskDescriptionFromIssue(issue.body),
    status: "to-do",
    priority: null,
    number: nextTaskNumber + 1,
  };

  if (priority) taskValues.priority = priority;
  if (status) taskValues.status = status;

  const [createdTask] = await db
    .insert(taskTable)
    .values(taskValues)
    .returning();

  if (!createdTask) {
    console.error("Failed to create task from GitHub issue");
    return;
  }

  await createExternalLink({
    taskId: createdTask.id,
    integrationId: integration.id,
    resourceType: "issue",
    externalId: issue.number.toString(),
    url: issue.html_url,
    title: issue.title,
    metadata: {
      state: "open",
      createdFrom: "github",
      author: issue.user?.login,
    },
  });

  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    console.error("Project not found for task linking comment");
    return;
  }

  const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
  const taskUrl = `${clientUrl}/dashboard/workspace/${project.workspaceId}/project/${projectId}/task/${createdTask.id}`;
  const taskIdentifier = `${project.slug.toUpperCase()}-${createdTask.number}`;

  try {
    let installationId = config.installationId;
    if (!installationId) {
      const { data: installation } =
        await githubApp.octokit.rest.apps.getRepoInstallation({
          owner: repository.owner.login,
          repo: repository.name,
        });
      installationId = installation.id;
    }

    const octokit = await githubApp.getInstallationOctokit(installationId);

    const existingLabels =
      issue.labels
        ?.map((label) => (typeof label === "string" ? label : label.name))
        .filter(Boolean) || [];

    const labelsToAdd: string[] = [];

    if (priority && !existingLabels.includes(`priority:${priority}`)) {
      labelsToAdd.push(`priority:${priority}`);
    }

    if (status && !existingLabels.includes(`status:${status}`)) {
      labelsToAdd.push(`status:${status}`);
    }

    if (labelsToAdd.length > 0) {
      await addLabelsToIssue(
        octokit,
        repository.owner.login,
        repository.name,
        issue.number,
        labelsToAdd,
      );
    }

    await octokit.rest.issues.createComment({
      owner: repository.owner.login,
      repo: repository.name,
      issue_number: issue.number,
      body: `[${taskIdentifier}](${taskUrl})`,
    });
  } catch (error) {
    console.error("Failed to process GitHub issue:", error);
  }
}
