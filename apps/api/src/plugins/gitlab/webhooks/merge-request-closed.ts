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
import type { GitlabWebhookProject } from "../utils/payload";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";

type MergeRequestClosedPayload = {
  object_attributes: {
    iid: number;
    title: string;
    url: string;
    state: string;
    action?: string;
    source_branch?: string;
  };
  project: GitlabWebhookProject;
};

export async function handleGitlabMergeRequestClosed(
  payload: MergeRequestClosedPayload,
  integrationId?: string,
) {
  const mergeRequest = payload.object_attributes;
  const { project } = payload;
  const merged = mergeRequest.action === "merge";

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
        eq(externalLinkTable.externalId, mergeRequest.iid.toString()),
      ),
    });

    if (!externalLink) {
      continue;
    }

    const task = await findTaskById(externalLink.taskId);

    if (!task) {
      continue;
    }

    let existingMetadata: Record<string, unknown> = {};
    if (externalLink.metadata) {
      try {
        existingMetadata = JSON.parse(externalLink.metadata) as Record<
          string,
          unknown
        >;
      } catch (error) {
        console.warn("Failed to parse GitLab merge request metadata", {
          externalLinkId: externalLink.id,
          metadata: externalLink.metadata,
          error,
        });
      }
    }

    await updateExternalLink(externalLink.id, {
      metadata: {
        ...existingMetadata,
        state: merged ? "merged" : "closed",
        draft: false,
        merged,
      },
    });

    if (!merged) {
      return;
    }

    const allTaskMergeRequests = await db.query.externalLinkTable.findMany({
      where: and(
        eq(externalLinkTable.taskId, task.id),
        eq(externalLinkTable.resourceType, "pull_request"),
      ),
    });

    const hasOpenMergeRequests = allTaskMergeRequests.some((link) => {
      if (link.id === externalLink.id) return false;
      try {
        const metadata = link.metadata
          ? (JSON.parse(link.metadata) as { state?: string })
          : {};
        return metadata.state === "opened";
      } catch {
        return false;
      }
    });

    if (hasOpenMergeRequests) {
      return;
    }

    const targetStatus = await resolveTargetStatus(
      integration.projectId,
      "pr_merged",
      config.statusTransitions?.onPRMerge || "done",
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

    return;
  }
}
