import { and, eq, inArray } from "drizzle-orm";
import db from "../../../database";
import { labelTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { findExternalLink } from "../../github/services/link-manager";
import { updateTaskStatus } from "../../github/services/task-service";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../github/utils/extract-priority";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { isSystemLabelName } from "../utils/system-labels";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type GitlabLabelRef = { id: number; title: string; color?: string };

type IssueLabeledPayload = {
  object_attributes: {
    iid: number;
    action: string;
  };
  changes?: {
    labels?: { previous: GitlabLabelRef[]; current: GitlabLabelRef[] };
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabIssueLabeled(
  payload: IssueLabeledPayload,
  integrationId?: string,
) {
  const { object_attributes: issue, project, changes } = payload;

  if (issue.action !== "update" || !changes?.labels) {
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

  const previous = changes.labels.previous ?? [];
  const current = changes.labels.current ?? [];
  const previousNames = new Set(previous.map((l) => l.title));
  const currentNames = current.map((l) => l.title);
  const currentNameSet = new Set(currentNames);

  for (const integration of integrations) {
    try {
      const existingLink = await findExternalLink(
        integration.id,
        "issue",
        issue.iid.toString(),
      );

      if (!existingLink) {
        continue;
      }

      const priority = extractIssuePriority(currentNames);
      const status = extractIssueStatus(currentNames);

      if (priority) {
        await db
          .update(taskTable)
          .set({ priority })
          .where(eq(taskTable.id, existingLink.taskId));
      }

      if (status) {
        const statusResult = await updateTaskStatus(
          existingLink.taskId,
          status,
        );
        if (
          statusResult.applied &&
          statusResult.before.status !== statusResult.after.status
        ) {
          await publishEvent("task.status_changed", {
            taskId: statusResult.after.id,
            projectId: statusResult.after.projectId,
            userId: null,
            oldStatus: statusResult.before.status,
            newStatus: statusResult.after.status,
            title: statusResult.after.title,
            assigneeId: statusResult.after.userId,
            type: "status_changed",
          });
        }
      }

      const task = await db.query.taskTable.findFirst({
        where: eq(taskTable.id, existingLink.taskId),
        with: {
          project: true,
        },
      });
      if (!task?.project?.workspaceId) {
        continue;
      }

      const addedLabels = current.filter(
        (label) =>
          !isSystemLabelName(label.title) && !previousNames.has(label.title),
      );

      for (const label of addedLabels) {
        const existingLabel = await db.query.labelTable.findFirst({
          where: and(
            eq(labelTable.workspaceId, task.project.workspaceId),
            eq(labelTable.name, label.title),
            eq(labelTable.taskId, task.id),
          ),
        });

        if (!existingLabel) {
          await db
            .insert(labelTable)
            .values({
              name: label.title,
              color: label.color ?? "#6B7280",
              taskId: task.id,
              workspaceId: task.project.workspaceId,
            })
            .onConflictDoNothing({
              target: [labelTable.taskId, labelTable.name],
            });
        }
      }

      const removedNames = [...previousNames].filter(
        (name) => !currentNameSet.has(name) && !isSystemLabelName(name),
      );

      if (removedNames.length > 0) {
        const labelsToDelete = await db.query.labelTable.findMany({
          where: and(
            eq(labelTable.taskId, existingLink.taskId),
            inArray(labelTable.name, removedNames),
          ),
        });

        for (const label of labelsToDelete) {
          await db.delete(labelTable).where(eq(labelTable.id, label.id));
        }
      }
    } catch (error) {
      console.error("GitLab issue_labeled handler failed for integration", {
        integrationId: integration.id,
        issueIid: issue.iid,
        project: project.path_with_namespace,
        error,
      });
    }
  }
}
