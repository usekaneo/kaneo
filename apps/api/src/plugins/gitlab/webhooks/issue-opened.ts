import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { columnTable, projectTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { claimTaskNumber } from "../../../task/controllers/claim-task-numbers";
import {
  createExternalLink,
  findExternalLink,
  updateExternalLink,
} from "../../github/services/link-manager";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../github/utils/extract-priority";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { createGitlabClient } from "../utils/gitlab-api";
import { taskDescriptionFromIssue } from "../utils/issue-description";
import { addLabelsToIssueGitlab } from "../utils/labels";
import type {
  GitlabWebhookLabel,
  GitlabWebhookProject,
  GitlabWebhookUser,
} from "../utils/payload";
import { labelTitles } from "../utils/payload";
import { resolveTargetStatus } from "../utils/resolve-column";
import { withSyncedNoteId } from "../utils/synced-notes";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";

type IssueOpenedPayload = {
  user?: GitlabWebhookUser | null;
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    url: string;
    action?: string;
    confidential?: boolean;
  };
  labels?: GitlabWebhookLabel[];
  project: GitlabWebhookProject;
};

export async function handleGitlabIssueOpened(
  payload: IssueOpenedPayload,
  integrationId?: string,
) {
  const issue = payload.object_attributes;
  const { project } = payload;

  // Confidential issues are visible only to project members in GitLab.
  if (issue.confidential) {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) {
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

  const existingLabels = labelTitles(payload.labels);
  const author = payload.user?.username ?? payload.user?.name;

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

    const priority = extractIssuePriority(existingLabels);
    const status = extractIssueStatus(existingLabels);

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
      description: taskDescriptionFromIssue(issue.description),
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

    const linkMetadata: Record<string, unknown> = {
      state: "opened",
      createdFrom: "gitlab",
      author,
    };

    // Must run before task.created: the plugin's onTaskCreated uses link
    // existence to skip self-originated tasks, else it duplicates the issue.
    const issueLink = await createExternalLink({
      taskId: createdTask.id,
      integrationId: integration.id,
      resourceType: "issue",
      externalId: issue.iid.toString(),
      url: issue.url,
      title: issue.title,
      metadata: linkMetadata,
    });

    await publishEvent("task.created", {
      ...createdTask,
      taskId: createdTask.id,
      userId: createdTask.userId ?? "",
      type: "task",
      content: null,
      source: "gitlab",
      externalId: issue.iid.toString(),
      actor: author ?? "gitlab-webhook",
    });

    const kaneoProject = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
    });

    if (!kaneoProject) {
      continue;
    }

    const clientUrl = process.env.KANEO_CLIENT_URL || "http://localhost:5173";
    const taskUrl = `${clientUrl}/dashboard/workspace/${kaneoProject.workspaceId}/project/${projectId}/task/${createdTask.id}`;
    const taskIdentifier = `${kaneoProject.slug.toUpperCase()}-${createdTask.number}`;

    try {
      const labelsToAdd: string[] = [];

      if (priority && !existingLabels.includes(`priority:${priority}`)) {
        labelsToAdd.push(`priority:${priority}`);
      }

      if (status && !existingLabels.includes(`status:${status}`)) {
        labelsToAdd.push(`status:${status}`);
      }

      if (labelsToAdd.length > 0) {
        await addLabelsToIssueGitlab(config, issue.iid, labelsToAdd);
      }

      if (config.commentTaskLinkOnGitlabIssue !== false) {
        const note = await createGitlabClient(config).createIssueNote(
          config.projectPath,
          issue.iid,
          `[${taskIdentifier}](${taskUrl})`,
        );

        await updateExternalLink(issueLink.id, {
          metadata: {
            ...linkMetadata,
            syncedNoteIds: withSyncedNoteId([], note.id),
          },
        });
      }
    } catch (error) {
      console.error("Failed to process GitLab issue:", error);
    }
  }
}
