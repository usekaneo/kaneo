import { eq } from "drizzle-orm";
import db from "../../../database";
import { taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import {
  findExternalLink,
  updateExternalLink,
} from "../../github/services/link-manager";
import { formatTaskDescriptionFromIssue } from "../../github/utils/format";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { createGitlabClient } from "../utils/gitlab-api";
import {
  findKaneoUserByEmail,
  resolveGitlabAssigneeEmail,
} from "../utils/user-matcher";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type SyncStamp = {
  timestamp: string;
  source: string;
  value: string;
};

type IssueEditedMetadata = {
  lastSync?: {
    title?: SyncStamp;
    description?: SyncStamp;
    assignee?: SyncStamp;
  };
  [key: string]: unknown;
};

type IssueEditedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    url: string;
    action: string;
    assignee_id?: number | null;
    assignee_ids?: number[];
  };
  assignees?: Array<{
    id?: number;
    name?: string;
    username?: string;
    email?: string;
  }>;
  assignee?: {
    id?: number;
    name?: string;
    username?: string;
    email?: string;
  } | null;
  changes?: {
    title?: { previous: string; current: string };
    description?: { previous: string; current: string };
    assignees?: {
      previous: Array<unknown>;
      current: Array<unknown>;
    };
    assignee_id?: { previous: unknown; current: unknown };
    assignee_ids?: { previous: unknown; current: unknown };
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabIssueEdited(
  payload: IssueEditedPayload,
  integrationId?: string,
) {
  const { object_attributes: issue, project, changes } = payload;

  if (issue.action !== "update") {
    return;
  }
  const hasAssigneeChange = Boolean(
    changes?.assignees || changes?.assignee_id || changes?.assignee_ids,
  );
  if (!changes?.title && !changes?.description && !hasAssigneeChange) {
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

  for (const integration of integrations) {
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
    });

    if (!task) {
      continue;
    }

    let metadata: IssueEditedMetadata = {};
    if (externalLink.metadata) {
      try {
        metadata = JSON.parse(externalLink.metadata) as IssueEditedMetadata;
      } catch (error) {
        console.warn("Failed to parse GitLab issue metadata for edit sync", {
          externalLinkId: externalLink.id,
          metadata: externalLink.metadata,
          error,
        });
      }
    }

    const updateData: Record<string, unknown> = {};
    const updatedMetadata: IssueEditedMetadata = { ...metadata };

    if (!updatedMetadata.lastSync) {
      updatedMetadata.lastSync = {};
    }

    if (changes?.title) {
      const lastTitleSync = metadata.lastSync?.title;

      let shouldUpdateTitle = true;

      if (lastTitleSync) {
        if (
          lastTitleSync.value === issue.title &&
          lastTitleSync.source === "kaneo"
        ) {
          shouldUpdateTitle = false;
        }

        const timeSinceLastSync =
          Date.now() - new Date(lastTitleSync.timestamp).getTime();
        if (timeSinceLastSync < 2000 && shouldUpdateTitle) {
          shouldUpdateTitle = false;
        }
      }

      if (shouldUpdateTitle) {
        updateData.title = issue.title;
        updatedMetadata.lastSync.title = {
          timestamp: new Date().toISOString(),
          source: "gitlab",
          value: issue.title,
        };
      }
    }

    if (changes?.description) {
      const lastDescSync = metadata.lastSync?.description;
      const formattedDescription = formatTaskDescriptionFromIssue(
        issue.description,
      );

      let shouldUpdateDescription = true;

      if (lastDescSync) {
        if (
          lastDescSync.value === formattedDescription &&
          lastDescSync.source === "kaneo"
        ) {
          shouldUpdateDescription = false;
        }

        const timeSinceLastSync =
          Date.now() - new Date(lastDescSync.timestamp).getTime();
        if (timeSinceLastSync < 2000 && shouldUpdateDescription) {
          shouldUpdateDescription = false;
        }
      }

      if (shouldUpdateDescription) {
        updateData.description = formattedDescription;
        updatedMetadata.lastSync.description = {
          timestamp: new Date().toISOString(),
          source: "gitlab",
          value: formattedDescription,
        };
      }
    }

    if (hasAssigneeChange) {
      const lastAssigneeSync = metadata.lastSync?.assignee;
      let shouldCheckAssignee = true;

      if (lastAssigneeSync) {
        const timeSinceLastSync =
          Date.now() - new Date(lastAssigneeSync.timestamp).getTime();
        if (timeSinceLastSync < 2000 && lastAssigneeSync.source === "kaneo") {
          shouldCheckAssignee = false;
        }
      }

      if (shouldCheckAssignee) {
        let config: GitlabConfig | null = null;
        try {
          config = JSON.parse(integration.config) as GitlabConfig;
        } catch {}

        const primaryAssignee = payload.assignees?.[0] || payload.assignee;
        if (!primaryAssignee) {
          if (task.userId !== null) {
            updateData.userId = null;
            updatedMetadata.lastSync.assignee = {
              timestamp: new Date().toISOString(),
              source: "gitlab",
              value: "",
            };
            await publishEvent("task.unassigned", {
              taskId: task.id,
              projectId: task.projectId,
              userId: null,
              title: task.title,
              type: "unassigned",
            });
          }
        } else if (config) {
          const client = createGitlabClient(config);
          const email = await resolveGitlabAssigneeEmail(
            client,
            primaryAssignee,
            config.repositoryPath,
          );

          if (email) {
            const kaneoUser = await findKaneoUserByEmail(email);
            if (kaneoUser && task.userId !== kaneoUser.id) {
              updateData.userId = kaneoUser.id;
              updatedMetadata.lastSync.assignee = {
                timestamp: new Date().toISOString(),
                source: "gitlab",
                value: email,
              };
              await publishEvent("task.assignee_changed", {
                taskId: task.id,
                projectId: task.projectId,
                userId: null,
                oldAssignee: task.userId,
                newAssignee: kaneoUser.name,
                newAssigneeId: kaneoUser.id,
                title: task.title,
                type: "assignee_changed",
              });
            }
          }
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(taskTable)
        .set(updateData)
        .where(eq(taskTable.id, task.id));

      await updateExternalLink(externalLink.id, {
        title: issue.title,
        metadata: updatedMetadata,
      });
    }

    return;
  }
}
