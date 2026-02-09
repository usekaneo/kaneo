import type { GitHubConfig } from "../config";
import { createOrUpdateExternalLink } from "../services/link-manager";
import {
  findAllIntegrationsByRepo,
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../services/task-service";
import { extractTaskNumberFromBranch } from "../utils/branch-matcher";
import { resolveTargetStatus } from "../utils/resolve-column";

type PushPayload = {
  ref: string;
  head_commit?: {
    id: string;
    message: string;
    author?: { name: string };
    timestamp: string;
  };
  repository: {
    owner: { login: string };
    name: string;
    html_url: string;
  };
};

const PROTECTED_BRANCHES = [
  "main",
  "master",
  "develop",
  "staging",
  "production",
];

export async function handlePush(payload: PushPayload) {
  const { ref, repository, head_commit } = payload;

  const branchName = ref.replace("refs/heads/", "");
  console.log(`[Push] Processing branch: ${branchName}`);

  if (PROTECTED_BRANCHES.includes(branchName)) {
    console.log(`[Push] Skipping protected branch: ${branchName}`);
    return;
  }

  const integrations = await findAllIntegrationsByRepo(
    repository.owner.login,
    repository.name,
  );

  if (integrations.length === 0) {
    console.log(
      `[Push] No integrations found for ${repository.owner.login}/${repository.name}`,
    );
    return;
  }

  console.log(
    `[Push] Found ${integrations.length} integration(s) for this repo`,
  );

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    const config = JSON.parse(integration.config) as GitHubConfig;
    const projectSlug = integration.project.slug;
    console.log(
      `[Push] Trying project: ${projectSlug}, pattern: ${config.branchPattern}`,
    );

    const taskNumber = extractTaskNumberFromBranch(
      branchName,
      config,
      projectSlug,
    );

    if (!taskNumber) {
      console.log(
        `[Push] Could not extract task number from branch: ${branchName} (pattern: ${config.branchPattern}, slug: ${projectSlug})`,
      );
      continue;
    }

    console.log(
      `[Push] Extracted task number: ${taskNumber} for project ${projectSlug}`,
    );

    const task = await findTaskByNumber(integration.projectId, taskNumber);

    if (!task) {
      console.log(
        `[Push] Task #${taskNumber} not found in project ${integration.projectId}`,
      );
      continue;
    }

    console.log(
      `[Push] Found task: ${task.id}, current status: ${task.status}`,
    );

    await createOrUpdateExternalLink({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "branch",
      externalId: branchName,
      url: `${repository.html_url}/tree/${branchName}`,
      title: branchName,
      metadata: {
        lastCommit: head_commit
          ? {
              sha: head_commit.id,
              message: head_commit.message,
              author: head_commit.author?.name,
              timestamp: head_commit.timestamp,
            }
          : null,
      },
    });

    const targetStatus = await resolveTargetStatus(
      integration.projectId,
      "branch_push",
      config.statusTransitions?.onBranchPush || "in-progress",
    );
    console.log(
      `[Push] Target status: ${targetStatus}, current: ${task.status}`,
    );

    const isTaskFinal = await isTaskInFinalState(task);

    if (task.status !== targetStatus && !isTaskFinal) {
      console.log(
        `[Push] Updating task ${task.id} status from ${task.status} to ${targetStatus}`,
      );
      await updateTaskStatus(task.id, targetStatus);
    } else {
      console.log(`[Push] Skipping status update - already ${task.status}`);
    }

    return;
  }

  console.log(
    `[Push] No matching task found in any integrated project for branch: ${branchName}`,
  );
}
