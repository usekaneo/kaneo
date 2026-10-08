import { acceptsIssue } from "../../sync/rules";
import { importIssueLabels } from "../../sync/issue-labels";
import { canSyncTask } from "../../sync/eligibility";
import { createIssueWrite } from "../../sync/dispatch-issue-write";
import { and, eq } from "drizzle-orm";
import db from "../../../database";
import {
  columnTable,
  integrationTable,
  projectTable,
  taskTable,
} from "../../../database/schema";
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
    state?: string;
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
    if (!acceptsIssue(integration.config, payload.labels)) continue;
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
    const closed = issue.state === "closed";

    const priority = extractIssuePriority(existingLabels);
    const status = extractIssueStatus(existingLabels);

    const result = await db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(integrationTable)
        .where(eq(integrationTable.id, integration.id))
        .for("update");
      if (
        !current?.isActive ||
        current.config !== integration.config ||
        !acceptsIssue(current.config, payload.labels)
      )
        return null;
      if (
        await findExternalLink(integration.id, "issue", String(issue.iid), tx)
      )
        return null;
      const resolvedStatus = await resolveTargetStatus(
        projectId,
        closed ? "issue_closed" : "issue_opened",
        closed ? "done" : status || "to-do",
        tx,
      );
      let targetColumn = await tx.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, projectId),
          eq(columnTable.slug, resolvedStatus),
        ),
      });
      if (closed && !targetColumn?.isFinal)
        targetColumn = await tx.query.columnTable.findFirst({
          where: and(
            eq(columnTable.projectId, projectId),
            eq(columnTable.isFinal, true),
          ),
          orderBy: (column, { asc }) => [asc(column.position)],
        });
      const nextTaskNumber = await claimTaskNumber(projectId, tx);
      const [task] = await tx
        .insert(taskTable)
        .values({
          projectId,
          userId: null,
          title: issue.title,
          description: taskDescriptionFromIssue(issue.description),
          status: closed ? (targetColumn?.slug ?? "done") : resolvedStatus,
          columnId: targetColumn?.id ?? null,
          priority: priority ?? "low",
          number: nextTaskNumber,
        })
        .returning();
      if (!task) throw new Error("Failed to create task from gitlab issue");
      const linkMetadata = {
        state: closed ? "closed" : "opened",
        createdFrom: "gitlab",
        author: author,
      };
      const link = await createExternalLink(
        {
          taskId: task.id,
          integrationId: integration.id,
          resourceType: "issue",
          externalId: String(issue.iid),
          url: issue.url,
          title: issue.title,
          metadata: linkMetadata,
        },
        tx,
      );
      await importIssueLabels(
        task.id,
        integration.project.workspaceId,
        payload.labels,
        tx,
      );
      const eligible = await canSyncTask(
        task.id,
        integration.id,
        tx,
        integration.config,
      );
      return { task, link, linkMetadata, eligible };
    });
    if (!result) continue;
    const {
      task: createdTask,
      link: issueLink,
      linkMetadata,
      eligible,
    } = result;

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
    if (!eligible) continue;
    const write = createIssueWrite(
      {
        id: issueLink.id,
        taskId: createdTask.id,
        integrationId: integration.id,
      },
      integration.config,
    );

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
        await addLabelsToIssueGitlab(
          config,
          issue.iid,
          labelsToAdd,
          true,
          write,
        );
      }

      if (config.commentTaskLinkOnGitlabIssue !== false) {
        const note = await write(() =>
          createGitlabClient(config).createIssueNote(
            config.projectPath,
            issue.iid,
            `[${taskIdentifier}](${taskUrl})`,
          ),
        );

        await updateExternalLink(issueLink.id, {
          metadata: {
            ...linkMetadata,
            syncedNoteIds: withSyncedNoteId([], note.id),
          },
        });
      }
    } catch {
      console.error("GitLab imported issue linking write failed", {
        projectId,
        taskId: createdTask.id,
        integrationId: integration.id,
        linkId: issueLink.id,
      });
    }
  }
}
