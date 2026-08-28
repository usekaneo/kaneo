import { and, eq } from "drizzle-orm";
import db from "../../../database";
import { externalLinkTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import { updateExternalLink } from "../../github/services/link-manager";
import {
  findTaskById,
  isTaskInFinalState,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";
import {
  handleGitlabMergeRequestOpened,
  isDraftMergeRequest,
  type MergeRequestPayload,
} from "./merge-request-opened";

/**
 * `update` covers everything short of open/close/merge, including a draft being
 * marked ready. Only the stored merge request state is refreshed, plus the
 * one transition a draft going ready implies.
 */
export async function handleGitlabMergeRequestUpdated(
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

  const draft = isDraftMergeRequest(mr);

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

    // A merge request opened as a draft, or opened before the webhook
    // existed, first reaches Kaneo here. Treat the first non-draft update as
    // the opening event so it still gets linked and moved.
    if (!externalLink) {
      if (!draft && mr.state === "opened") {
        await handleGitlabMergeRequestOpened(payload, integrationId);
        return;
      }
      continue;
    }

    const existingMetadata = externalLink.metadata
      ? (JSON.parse(externalLink.metadata) as Record<string, unknown>)
      : {};

    const wasDraft = existingMetadata.draft === true;

    await updateExternalLink(externalLink.id, {
      title: mr.title,
      metadata: {
        ...existingMetadata,
        state: mr.state,
        draft,
        branch: mr.source_branch ?? existingMetadata.branch,
      },
    });

    if (!wasDraft || draft || mr.state !== "opened") {
      return;
    }

    const task = await findTaskById(externalLink.taskId);
    if (!task) {
      return;
    }

    const targetStatus = await resolveTargetStatus(
      integration.projectId,
      "pr_opened",
      config.statusTransitions?.onPROpen || "in-review",
    );

    if (task.status === targetStatus || (await isTaskInFinalState(task))) {
      return;
    }

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
