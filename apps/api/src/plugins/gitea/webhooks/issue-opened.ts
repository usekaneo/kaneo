import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { columnTable, projectTable, taskTable } from "../../../database/schema";
import getNextTaskNumber from "../../../task/controllers/get-next-task-number";
import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../github/utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../../github/utils/format";
import type { GiteaConfig } from "../config";
import {
  findAllIntegrationsByGiteaRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import { createGiteaClient } from "../utils/gitea-api";
import { addLabelsToIssueGitea } from "../utils/labels";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

type IssueOpenedPayload = {
  action: string;
  issue: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    labels?: Array<string | { name?: string }>;
    user: { login?: string; username?: string } | null;
  };
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

export async function handleGiteaIssueOpened(payload: IssueOpenedPayload) {
  const { issue, repository } = payload;

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) {
    return;
  }

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
    repository.name,
  );

  if (integrations.length === 0) {
    return;
  }

  for (const integration of integrations) {
    const config = JSON.parse(integration.config) as GiteaConfig;
    const projectId = integration.projectId;

    const priority = extractIssuePriority(issue.labels);
    const status = extractIssueStatus(issue.labels);

    const existingLink = await findExternalLink(
      integration.id,
      "issue",
      issue.number.toString(),
    );

    if (existingLink) {
      continue;
    }

    const nextTaskNumber = await getNextTaskNumber(projectId);

    const resolvedStatus = await resolveTargetStatus(
      projectId,
      "issue_opened",
      status || "to-do",
    );

    const targetColumn = await db.query.columnTable.findFirst({
      where: and(
        eq(columnTable.projectId, projectId),
        eq(columnTable.slug, resolvedStatus),
      ),
    });

    const taskValues: typeof taskTable.$inferInsert = {
      projectId,
      userId: null,
      title: issue.title,
      description: formatTaskDescriptionFromIssue(issue.body),
      status: resolvedStatus,
      columnId: targetColumn?.id ?? null,
      priority: null,
      number: nextTaskNumber + 1,
    };

    if (priority) taskValues.priority = priority;

    const [createdTask] = await db
      .insert(taskTable)
      .values(taskValues)
      .returning();

    if (!createdTask) {
      console.error("Failed to create task from Gitea issue");
      continue;
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
        createdFrom: "gitea",
        author: issue.user?.login ?? issue.user?.username,
      },
    });

    const project = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
    });

    if (!project) {
      continue;
    }

    const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
    const taskUrl = `${clientUrl}/dashboard/workspace/${project.workspaceId}/project/${projectId}/task/${createdTask.id}`;
    const taskIdentifier = `${project.slug.toUpperCase()}-${createdTask.number}`;

    try {
      const client = createGiteaClient(config);

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
        await addLabelsToIssueGitea(config, issue.number, labelsToAdd);
      }

      if (config.commentTaskLinkOnGiteaIssue !== false) {
        await client.createIssueComment(
          config.repositoryOwner,
          config.repositoryName,
          issue.number,
          `[${taskIdentifier}](${taskUrl})`,
        );
      }
    } catch (error) {
      console.error("Failed to process Gitea issue:", error);
    }
  }
}
