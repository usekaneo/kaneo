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
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";
import type { MergeRequestPayload } from "./merge-request-opened";

export async function handleGitlabMergeRequestClosed(
  payload: MergeRequestPayload,
  integrationId?: string,
) {
  const mr = payload.object_attributes;
  const { project } = payload;

  const baseUrl = baseUrlFromProjectWebUrl(project);
  if (!baseUrl || !project.path_with_namespace) return;

  const integrations = await findAllIntegrationsByGitlabProject(
    baseUrl,
    project.path_with_namespace,
    integrationId,
  );

  const merged = mr.action === "merge" || mr.state === "merged";

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

    const existingMetadata = externalLink.metadata
      ? JSON.parse(externalLink.metadata)
      : {};

    await updateExternalLink(externalLink.id, {
      metadata: {
        ...existingMetadata,
        state: merged ? "merged" : "closed",
        draft: false,
        merged,
        mergedAt: mr.merged_at ?? null,
      },
    });

    if (!merged) {
      return;
    }

    const allTaskPRs = await db.query.externalLinkTable.findMany({
      where: and(
        eq(externalLinkTable.taskId, task.id),
        eq(externalLinkTable.resourceType, "pull_request"),
      ),
    });

    const hasOpenPRs = allTaskPRs.some((pr) => {
      if (pr.id === externalLink.id) return false;
      const metadata = pr.metadata ? JSON.parse(pr.metadata) : {};
      return metadata.state === "opened";
    });

    if (hasOpenPRs) {
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
