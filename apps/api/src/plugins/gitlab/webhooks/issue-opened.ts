import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { columnTable, projectTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { claimTaskNumber } from "../../../task/controllers/claim-task-numbers";
import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../github/utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../../github/utils/format";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { createGitlabClient } from "../utils/gitlab-api";
import { addLabelsToIssueGitlab } from "../utils/labels";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";
import {
  type GitlabWebhookLabel,
  type GitlabWebhookProject,
  type GitlabWebhookUser,
  webhookLabelNames,
} from "./types";

export type IssuePayload = {
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    url: string;
    state: string;
    action?: string;
    updated_at?: string;
  };
  labels?: GitlabWebhookLabel[];
  user?: GitlabWebhookUser | null;
  project: GitlabWebhookProject;
};

export async function handleGitlabIssueOpened(
  payload: IssuePayload,
  integrationId?: string,
) {
  const issue = payload.object_attributes;
  const { project } = payload;

  const baseUrl = baseUrlFromProjectWebUrl(project);
  if (!baseUrl || !project.path_with_namespace) {
    return;
  }

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  if (integrations.length === 0) {
    return;
  }

  const labels = webhookLabelNames(payload.labels);

  for (const integration of integrations) {
    let config: GitlabConfig;
    try {
      config = JSON.parse(integration.config) as GitlabConfig;
    } catch (error) {
      console.error("Invalid GitLab config for integration", {
        integrationId: integration.id,
        error,
      });
      continue;
    }
    const projectId = integration.projectId;

    const priority = extractIssuePriority(labels);
    const status = extractIssueStatus(labels);

    const existingLink = await findExternalLink(
      integration.id,
      "issue",
      issue.iid.toString(),
    );

    if (existingLink) {
      continue;
    }

    const nextTaskNumber = await claimTaskNumber(projectId);

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
      description: formatTaskDescriptionFromIssue(issue.description),
      status: resolvedStatus,
      columnId: targetColumn?.id ?? null,
      priority: priority ?? "low",
      number: nextTaskNumber,
    };

    const [createdTask] = await db
      .insert(taskTable)
      .values(taskValues)
      .returning();

    if (!createdTask) {
      console.error("Failed to create task from GitLab issue");
      continue;
    }

    // Must run before task.created: the plugin's onTaskCreated uses link
    // existence to skip self-originated tasks, else it duplicates the issue.
    await createExternalLink({
      taskId: createdTask.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: issue.iid.toString(),
      url: issue.url,
      title: issue.title,
      metadata: {
        state: "opened",
        createdFrom: "gitlab",
        author: payload.user?.username ?? payload.user?.name,
      },
    });

    await publishEvent("task.created", {
      ...createdTask,
      taskId: createdTask.id,
      userId: createdTask.userId ?? "",
      type: "task",
      content: null,
      source: "gitlab",
      externalId: issue.iid.toString(),
      actor: payload.user?.username ?? payload.user?.name ?? "gitlab-webhook",
    });

    const linkedProject = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
    });

    if (!linkedProject) {
      continue;
    }

    const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
    const taskUrl = `${clientUrl}/dashboard/workspace/${linkedProject.workspaceId}/project/${projectId}/task/${createdTask.id}`;
    const taskIdentifier = `${linkedProject.slug.toUpperCase()}-${createdTask.number}`;

    try {
      const labelsToAdd: string[] = [];

      if (priority && !labels.includes(`priority:${priority}`)) {
        labelsToAdd.push(`priority:${priority}`);
      }

      if (status && !labels.includes(`status:${status}`)) {
        labelsToAdd.push(`status:${status}`);
      }

      if (labelsToAdd.length > 0) {
        await addLabelsToIssueGitlab(config, issue.iid, labelsToAdd);
      }

      if (config.commentTaskLinkOnGitlabIssue !== false) {
        await createGitlabClient(config).createIssueNote(
          issue.iid,
          `[${taskIdentifier}](${taskUrl})`,
        );
      }
    } catch (error) {
      console.error("Failed to process GitLab issue:", error);
    }
  }
}
