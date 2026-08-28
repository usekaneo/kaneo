import { publishEvent } from "../../../events";
import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
import {
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GitlabConfig } from "../config";
import { findAllIntegrationsByGitlabProject } from "../services/integration-lookup";
import { extractTaskNumberGitlab } from "../utils/branch-matcher";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromProjectWebUrl } from "../utils/webhook-project";
import type { GitlabWebhookProject, GitlabWebhookUser } from "./types";

export type MergeRequestPayload = {
  object_attributes: {
    iid: number;
    title: string;
    description: string | null;
    url: string;
    state: string;
    action?: string;
    source_branch?: string;
    work_in_progress?: boolean;
    draft?: boolean;
    merged_at?: string | null;
  };
  user?: GitlabWebhookUser | null;
  project: GitlabWebhookProject;
};

export function isDraftMergeRequest(
  mr: MergeRequestPayload["object_attributes"],
): boolean {
  return mr.draft ?? mr.work_in_progress ?? false;
}

export async function handleGitlabMergeRequestOpened(
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

    const branchName = mr.source_branch ?? "";
    const taskNumber = extractTaskNumberGitlab(
      branchName,
      mr.title,
      mr.description ?? undefined,
      config,
      integration.project.slug,
    );

    if (!taskNumber) {
      continue;
    }

    const task = await findTaskByNumber(integration.projectId, taskNumber);

    if (!task) {
      continue;
    }

    const existingLink = await findExternalLink(
      integration.id,
      "pull_request",
      mr.iid.toString(),
    );

    if (existingLink) {
      continue;
    }

    await createExternalLink({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "pull_request",
      externalId: mr.iid.toString(),
      url: mr.url,
      title: mr.title,
      metadata: {
        state: mr.state,
        draft: isDraftMergeRequest(mr),
        merged: mr.state === "merged",
        branch: branchName,
        author: payload.user?.username ?? payload.user?.name,
      },
    });

    // A draft merge request is not ready for review, so the board should not
    // claim it is.
    if (isDraftMergeRequest(mr)) {
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
