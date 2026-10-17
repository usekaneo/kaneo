import { resumeLabelChanges } from "../../sync/resume-label-changes";
import { acceptsIssue, readSyncRules } from "../../sync/rules";
import { handleGitlabIssueOpened } from "./issue-opened";
import { withIntegrationLink } from "../../github/services/with-integration-link";
import {
  type IntegrationDatabase,
  linkedTaskScope,
} from "../../github/services/integration-task-scope";
import { eq, inArray } from "drizzle-orm";
import { labelTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import {
  findExternalLink,
  updateExternalLink,
} from "../../github/services/link-manager";
import { updateTaskStatus } from "../../github/services/task-service";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../github/utils/extract-priority";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { taskDescriptionFromIssue } from "../utils/issue-description";
import {
  isEchoOf,
  type LinkMetadata,
  parseLinkSyncMetadata,
} from "../utils/link-sync";
import type {
  GitlabWebhookLabel,
  GitlabWebhookProject,
} from "../utils/payload";
import { labelColor, labelTitles } from "../utils/payload";
import { isSystemLabelName } from "../utils/system-labels";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";

// Edits and label changes arrive together as one "update" action.
type IssueUpdatedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    state?: string;
    description: string | null;
    url: string;
    action?: string;
  };
  labels?: GitlabWebhookLabel[];
  changes?: {
    title?: { previous?: string | null; current?: string | null };
    description?: { previous?: string | null; current?: string | null };
    labels?: {
      previous?: GitlabWebhookLabel[];
      current?: GitlabWebhookLabel[];
    };
  };
  project: GitlabWebhookProject;
};

function nonSystemLabels(
  labels: GitlabWebhookLabel[] | undefined,
): Array<{ name: string; color: string }> {
  const out: Array<{ name: string; color: string }> = [];
  for (const label of labels ?? []) {
    if (!label.title || isSystemLabelName(label.title)) continue;
    out.push({ name: label.title, color: labelColor(label) });
  }
  return out;
}

async function syncGitlabLabelsToTask(
  taskId: string,
  workspaceId: string,
  gitlabLabels: Array<{ name: string; color: string }>,
  previousLabels: GitlabWebhookLabel[] | undefined,
  db: IntegrationDatabase,
  resumeBaseline?: string[],
) {
  const desiredNames = new Set(gitlabLabels.map((l) => l.name));
  const existingRows = await db.query.labelTable.findMany({
    where: eq(labelTable.taskId, taskId),
  });

  const labelsToInsert = gitlabLabels
    .filter(
      (g) =>
        (!resumeBaseline || !resumeBaseline.includes(g.name)) &&
        !existingRows.some((row) => row.name === g.name),
    )
    .map((g) => ({
      name: g.name,
      color: g.color,
      taskId,
      workspaceId,
    }));

  const colorToIds = new Map<string, string[]>();
  for (const g of gitlabLabels) {
    const row = existingRows.find((r) => r.name === g.name);
    if (!row) continue;
    const have = row.color ? `#${row.color.replace(/^#/, "")}` : "#6B7280";
    if (have === g.color) continue;
    const list = colorToIds.get(g.color) ?? [];
    list.push(row.id);
    colorToIds.set(g.color, list);
  }

  for (const [color, ids] of colorToIds) {
    await db
      .update(labelTable)
      .set({ color })
      .where(inArray(labelTable.id, ids));
  }

  if (labelsToInsert.length > 0) {
    await db
      .insert(labelTable)
      .values(labelsToInsert)
      .onConflictDoNothing({
        target: [labelTable.taskId, labelTable.name],
      });
  }

  // Absence from GitLab alone does not imply removal: local labels may not
  // have synced yet. Only delete names explicitly removed by this event.
  const previousNames = new Set(
    resumeBaseline ??
      nonSystemLabels(previousLabels).map((label) => label.name),
  );
  const labelsToDelete = existingRows
    .filter(
      (row) =>
        !isSystemLabelName(row.name) &&
        previousNames.has(row.name) &&
        !desiredNames.has(row.name),
    )
    .map((row) => row.id);

  if (labelsToDelete.length > 0) {
    await db.delete(labelTable).where(inArray(labelTable.id, labelsToDelete));
  }
}

export async function handleGitlabIssueUpdated(
  payload: IssueUpdatedPayload,
  integrationId?: string,
) {
  const issue = payload.object_attributes;
  const { project, changes } = payload;

  const touchedText = Boolean(changes?.title || changes?.description);
  const touchedLabels = Boolean(changes?.labels);

  if (!touchedText && !touchedLabels) {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(
    project.web_url,
    project.path_with_namespace,
  );
  if (!baseUrl) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  const currentLabels = changes?.labels?.current ?? payload.labels;

  for (const integration of integrations) {
    try {
      const externalLink = await findExternalLink(
        integration.id,
        "issue",
        issue.iid.toString(),
      );

      if (!externalLink) {
        if (
          touchedLabels &&
          readSyncRules(integration.config)?.incoming.mode === "labels" &&
          acceptsIssue(integration.config, currentLabels)
        ) {
          await handleGitlabIssueOpened(
            { ...payload, labels: currentLabels },
            integration.id,
          );
        }
        continue;
      }

      await withIntegrationLink(
        externalLink,
        integration,
        async (db, afterCommit, externalLink) => {
          const task = await db.query.taskTable.findFirst({
            where: linkedTaskScope(externalLink.taskId, integration.projectId),
            with: { project: true },
          });

          if (!task) {
            return;
          }

          let metadata: LinkMetadata = parseLinkSyncMetadata(
            externalLink.metadata,
            { externalLinkId: externalLink.id, field: "issue" },
          );

          if (touchedText) {
            const updateData: Record<string, unknown> = {};
            const lastSync = { ...metadata.lastSync };
            const now = new Date().toISOString();

            if (
              changes?.title &&
              !isEchoOf(metadata.lastSync?.title, "kaneo", issue.title)
            ) {
              updateData.title = issue.title;
              lastSync.title = {
                timestamp: now,
                source: "gitlab",
                value: issue.title,
              };
            }

            if (changes?.description) {
              // Kaneo recorded the body with its footer, so compare the raw body.
              const issueBody = issue.description ?? "";
              if (
                !isEchoOf(metadata.lastSync?.description, "kaneo", issueBody)
              ) {
                const description = taskDescriptionFromIssue(issue.description);
                updateData.description = description;
                lastSync.description = {
                  timestamp: now,
                  source: "gitlab",
                  value: description,
                };
              }
            }

            if (Object.keys(updateData).length > 0) {
              await db
                .update(taskTable)
                .set(updateData)
                .where(linkedTaskScope(task.id, integration.projectId));

              metadata = { ...metadata, lastSync };

              await updateExternalLink(
                externalLink.id,
                {
                  title: issue.title,
                  metadata,
                },
                db,
              );
              afterCommit(() =>
                publishEvent("task.updated", {
                  projectId: integration.projectId,
                  taskId: task.id,
                  ...(typeof updateData.title === "string"
                    ? { titleChanged: true }
                    : {}),
                }),
              );
            }
          }

          if (!touchedLabels || !currentLabels) {
            return;
          }

          const titles = labelTitles(currentLabels);
          const labelChanges = resumeLabelChanges(externalLink, titles);
          if (labelChanges.baseline)
            await updateExternalLink(
              externalLink.id,
              { metadata: { syncResumeLabelBaseline: titles } },
              db,
            );

          const priority = extractIssuePriority(titles);
          const status = extractIssueStatus(titles);

          if (priority && labelChanges.priorityChanged) {
            await db
              .update(taskTable)
              .set({ priority })
              .where(linkedTaskScope(task.id, integration.projectId));
          }

          // Unrelated label edits also include the full label snapshot. Its status
          // can predate a close/reopen, so only apply an actual status-label change.
          const previousStatus = extractIssueStatus(
            labelTitles(changes?.labels?.previous),
          );
          if (
            status &&
            labelChanges.statusChanged &&
            status !== previousStatus
          ) {
            const statusResult = await updateTaskStatus(task.id, status, db);
            if (
              statusResult.applied &&
              statusResult.before.status !== statusResult.after.status
            ) {
              afterCommit(() =>
                publishEvent("task.status_changed", {
                  sourceIntegrationId: integration.id,
                  taskId: statusResult.after.id,
                  projectId: statusResult.after.projectId,
                  userId: null,
                  oldStatus: statusResult.before.status,
                  newStatus: statusResult.after.status,
                  title: statusResult.after.title,
                  assigneeId: statusResult.after.userId,
                  type: "status_changed",
                }),
              );
            }
          }

          if (task.project?.workspaceId) {
            await syncGitlabLabelsToTask(
              task.id,
              task.project.workspaceId,
              nonSystemLabels(currentLabels),
              changes?.labels?.previous,
              db,
              labelChanges.baseline,
            );
            afterCommit(() =>
              publishEvent("task.labels_updated", {
                projectId: integration.projectId,
                taskId: task.id,
              }),
            );
          }
        },
      );
    } catch (error) {
      console.error("GitLab issue update handler failed for integration", {
        integrationId: integration.id,
        issueIid: issue.iid,
        project: project.path_with_namespace,
        error,
      });
    }
  }
}
