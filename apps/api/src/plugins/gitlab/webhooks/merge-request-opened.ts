import { publishEvent } from "../../../events";
import {
  createExternalLink,
  findExternalLink,
  updateExternalLink,
} from "../../github/services/link-manager";
import {
  findTaskById,
  findTaskByLink,
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../../github/services/task-service";
import { parseLinkMetadata } from "../../github/utils/parse-link-metadata";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { extractTaskNumberGitlab } from "../utils/branch-matcher";
import type { GitlabWebhookProject, GitlabWebhookUser } from "../utils/payload";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";

type MergeRequestOpenedPayload = {
  user?: GitlabWebhookUser | null;
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    url: string;
    state: string;
    action?: string;
    draft?: boolean;
    source_branch?: string;
  };
  project: GitlabWebhookProject;
};

export async function handleGitlabMergeRequestOpened(
  payload: MergeRequestOpenedPayload,
  integrationId?: string,
  { moveTask = true }: { moveTask?: boolean } = {},
) {
  const mergeRequest = payload.object_attributes;
  const { project } = payload;
  const branchName = mergeRequest.source_branch;

  if (!branchName) {
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
    if (!integration.project) {
      continue;
    }

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

    const existingLink = await findExternalLink(
      integration.id,
      "pull_request",
      mergeRequest.iid.toString(),
    );

    const linkedTask =
      existingLink && (await findTaskById(existingLink.taskId));
    if (existingLink && linkedTask?.projectId !== integration.projectId) {
      continue;
    }

    const taskNumber = extractTaskNumberGitlab(
      branchName,
      mergeRequest.title,
      mergeRequest.description ?? undefined,
      config,
      integration.project.slug,
    );

    const task =
      linkedTask ||
      (taskNumber &&
        (await findTaskByNumber(integration.projectId, taskNumber))) ||
      (await findTaskByLink(integration.projectId, [
        mergeRequest.title,
        mergeRequest.description,
      ]));

    if (!task) {
      continue;
    }

    const metadata = {
      state: mergeRequest.state,
      draft: mergeRequest.draft === true,
      merged: false,
      branch: branchName,
      author: payload.user?.username ?? payload.user?.name,
    };

    if (existingLink) {
      await updateExternalLink(existingLink.id, {
        title: mergeRequest.title,
        url: mergeRequest.url,
        metadata,
      });
    } else {
      await createExternalLink({
        taskId: task.id,
        integrationId: integration.id,
        resourceType: "pull_request",
        externalId: mergeRequest.iid.toString(),
        url: mergeRequest.url,
        title: mergeRequest.title,
        metadata,
      });
    }

    if (!moveTask) {
      return;
    }

    // On reopen the link already exists, but the task still has to move.
    const targetStatus = await resolveTargetStatus(
      integration.projectId,
      "pr_opened",
      config.statusTransitions?.onPROpen || "in-review",
    );

    const wasDraft =
      parseLinkMetadata<{ draft: boolean }>(existingLink?.metadata, {
        externalLinkId: existingLink?.id ?? "",
        source: "gitlab-merge-request-opened",
      }).draft === true;
    const canMove =
      !existingLink || wasDraft || !(await isTaskInFinalState(task));

    if (task.status !== targetStatus && canMove) {
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

    return;
  }
}
