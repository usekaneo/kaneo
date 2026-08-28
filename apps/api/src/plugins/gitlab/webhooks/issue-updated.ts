import { eq } from "drizzle-orm";
import db from "../../../database";
import { taskTable } from "../../../database/schema";
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
import { formatTaskDescriptionFromIssue } from "../../github/utils/format";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { syncIssueLabelsToTask } from "../utils/task-labels";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";
import type { IssuePayload } from "./issue-opened";
import { type GitlabWebhookLabel, webhookLabelNames } from "./types";

type IssueUpdatedPayload = IssuePayload & {
  changes?: {
    title?: { previous?: string | null; current?: string | null };
    description?: { previous?: string | null; current?: string | null };
    labels?: {
      previous?: GitlabWebhookLabel[];
      current?: GitlabWebhookLabel[];
    };
  };
};

type LinkSyncState = { timestamp: string; source: string; value: string };
type LinkMetadata = {
  lastSync?: {
    title?: LinkSyncState;
    description?: LinkSyncState;
    status?: LinkSyncState;
  };
  [key: string]: unknown;
};

const ECHO_WINDOW_MS = 2000;

/** What issue-opened gives a task when the issue carries no priority label. */
const DEFAULT_ISSUE_PRIORITY = "low";

/**
 * True when the incoming value is Kaneo's own edit coming back around. Identity
 * is the value itself; the window only bounds how long an identical value is
 * still assumed to be that echo. A differing value is always a real GitLab
 * edit, even when it lands inside the window.
 */
function isOwnEcho(last: LinkSyncState | undefined, incoming: string): boolean {
  if (last?.source !== "kaneo" || last.value !== incoming) {
    return false;
  }
  return Date.now() - new Date(last.timestamp).getTime() < ECHO_WINDOW_MS;
}

export async function handleGitlabIssueUpdated(
  payload: IssueUpdatedPayload,
  integrationId?: string,
) {
  const issue = payload.object_attributes;
  const { project, changes } = payload;

  const titleChanged = changes?.title !== undefined;
  const descriptionChanged = changes?.description !== undefined;
  const labelsChanged = changes?.labels !== undefined;

  if (!titleChanged && !descriptionChanged && !labelsChanged) {
    return;
  }

  const baseUrl = baseUrlFromProjectWebUrl(project);
  if (!baseUrl || !project.path_with_namespace) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  for (const integration of integrations) {
    try {
      const externalLink = await findExternalLink(
        integration.id,
        "issue",
        issue.iid.toString(),
      );

      if (!externalLink) {
        continue;
      }

      const task = await db.query.taskTable.findFirst({
        where: eq(taskTable.id, externalLink.taskId),
        with: { project: true },
      });

      if (!task) {
        continue;
      }

      let metadata: LinkMetadata = {};
      if (externalLink.metadata) {
        try {
          metadata = JSON.parse(externalLink.metadata) as LinkMetadata;
        } catch (error) {
          console.warn(
            "Failed to parse GitLab issue metadata for update sync",
            {
              externalLinkId: externalLink.id,
              error,
            },
          );
        }
      }

      const updateData: Record<string, unknown> = {};
      const lastSync = { ...(metadata.lastSync ?? {}) };

      if (titleChanged && !isOwnEcho(metadata.lastSync?.title, issue.title)) {
        updateData.title = issue.title;
        lastSync.title = {
          timestamp: new Date().toISOString(),
          source: "gitlab",
          value: issue.title,
        };
      }

      if (descriptionChanged) {
        const description = formatTaskDescriptionFromIssue(issue.description);
        if (!isOwnEcho(metadata.lastSync?.description, description)) {
          updateData.description = description;
          lastSync.description = {
            timestamp: new Date().toISOString(),
            source: "gitlab",
            value: description,
          };
        }
      }

      if (labelsChanged) {
        const current = changes?.labels?.current ?? payload.labels ?? [];
        const names = webhookLabelNames(current);

        // `changes.labels.current` is the whole set, so a missing priority:
        // label means it was removed, not absent from the event. Falling back
        // matches what a freshly opened issue with no priority label gets.
        const priority = extractIssuePriority(names);
        if (priority) {
          updateData.priority = priority;
        } else if (task.priority !== DEFAULT_ISSUE_PRIORITY) {
          updateData.priority = DEFAULT_ISSUE_PRIORITY;
        }

        const status = extractIssueStatus(names);
        // Kaneo swaps the status: label itself whenever a task moves, and that
        // edit comes straight back as a label change. Applying it again would
        // undo a status the user changed in the meantime.
        if (status && !isOwnEcho(metadata.lastSync?.status, status)) {
          const statusResult = await updateTaskStatus(task.id, status);
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

        await syncIssueLabelsToTask(
          task.id,
          task.project?.workspaceId,
          current,
        );
      }

      if (Object.keys(updateData).length > 0) {
        await db
          .update(taskTable)
          .set(updateData)
          .where(eq(taskTable.id, task.id));

        await updateExternalLink(externalLink.id, {
          title: issue.title,
          metadata: { ...metadata, lastSync },
        });
      }
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
