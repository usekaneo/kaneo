import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import {
  findTaskById,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-repo";

type MRClosedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    state: string;
    action: string;
    source_branch: string;
  };
  project: {
    path_with_namespace: string;
    web_url: string;
  };
};

export async function handleGitlabMergeRequestClosed(
  payload: MRClosedPayload,
  integrationId?: string,
) {
  const { object_attributes: mr, project } = payload;

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

  const merged = mr.state === "merged";

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

    const externalLink = await db.query.externalLinkTable.findFirst({
      where: and(
        eq(externalLinkTable.integrationId, integration.id),
        eq(externalLinkTable.resourceType, "pull_request"),
        eq(externalLinkTable.externalId, mr.iid.toString()),
      ),
    });

    if (!externalLink) {
      continue;
    }

    const task = await findTaskById(externalLink.taskId);

    if (!task) {
      continue;
    }

    let existingMetadata: Record<string, unknown>;
    if (externalLink.metadata) {
      try {
        existingMetadata = JSON.parse(externalLink.metadata);
      } catch (error) {
        console.warn("Failed to parse external link metadata", {
          externalLinkId: externalLink.id,
          metadata: externalLink.metadata,
          error,
        });
        existingMetadata = {};
      }
    } else {
      existingMetadata = {};
    }

    await updateExternalLink(externalLink.id, {
      metadata: {
        ...existingMetadata,
        state: mr.state,
        merged,
      },
    });

    if (merged) {
      const allTaskMRs = await db.query.externalLinkTable.findMany({
        where: and(
          eq(externalLinkTable.taskId, task.id),
          eq(externalLinkTable.resourceType, "pull_request"),
        ),
      });

      const hasOpenMRs = allTaskMRs.some((mrLink) => {
        if (mrLink.id === externalLink.id) return false;
        let metadata: Record<string, unknown>;
        if (mrLink.metadata) {
          try {
            metadata = JSON.parse(mrLink.metadata);
          } catch (error) {
            console.warn("Failed to parse MR link metadata", {
              mrLinkId: mrLink.id,
              metadata: mrLink.metadata,
              error,
            });
            metadata = {};
          }
        } else {
          metadata = {};
        }
        return metadata.state === "opened";
      });

      if (!hasOpenMRs) {
        const targetStatus = await resolveTargetStatus(
          integration.projectId,
          "pr_merged",
          config.statusTransitions?.onMRMerge || "done",
        );
        const statusResult = await updateTaskStatus(task.id, targetStatus);
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
    }

    return;
  }
}
