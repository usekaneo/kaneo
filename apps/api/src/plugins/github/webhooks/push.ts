import {
  linkedTaskScope,
  withIntegrationTask,
} from "../../github/services/integration-task-scope";
import { publishEvent } from "../../../events";
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
  after?: string;
  ref: string;
  head_commit?: {
    id: string;
    message: string;
    author?: { name: string };
    timestamp: string;
  };
  installation?: { id: number };
  repository: {
    id: number;
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

  if (/^0+$/.test(payload.after ?? "")) {
    return;
  }

  if (!ref.startsWith("refs/heads/")) {
    return;
  }

  const branchName = ref.slice("refs/heads/".length);
  console.log(`[Push] Processing branch: ${branchName}`);

  if (PROTECTED_BRANCHES.includes(branchName)) {
    console.log(`[Push] Skipping protected branch: ${branchName}`);
    return;
  }

  const integrations = await findAllIntegrationsByRepo(payload);

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

    const taskId = task.id;
    await withIntegrationTask(
      taskId,
      integration,
      async (database, afterCommit) => {
        const current = await database.query.taskTable.findFirst({
          where: linkedTaskScope(taskId, integration.projectId),
        });
        if (!current) return;
        const task = current;
        const branchLink = await createOrUpdateExternalLink(
          {
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
          },
          database,
        );

        const targetStatus = await resolveTargetStatus(
          integration.projectId,
          "branch_push",
          config.statusTransitions?.onBranchPush || "in-progress",
          database,
        );
        console.log(
          `[Push] Target status: ${targetStatus}, current: ${task.status}`,
        );

        const canMove =
          branchLink.created || !(await isTaskInFinalState(task, database));

        if (task.status !== targetStatus && canMove) {
          console.log(
            `[Push] Updating task ${task.id} status from ${task.status} to ${targetStatus}`,
          );
          const statusResult = await updateTaskStatus(
            task.id,
            targetStatus,
            database,
          );
          if (
            statusResult.applied &&
            statusResult.before.status !== statusResult.after.status
          ) {
            afterCommit(() =>
              publishEvent("task.status_changed", {
                taskId: statusResult.after.id,
                projectId: statusResult.after.projectId,
                userId: null,
                oldStatus: statusResult.before.status,
                newStatus: statusResult.after.status,
                title: statusResult.after.title,
                assigneeId: statusResult.after.userId,
                type: "status_changed",
              }),
            );
          }
        } else {
          console.log(`[Push] Skipping status update - already ${task.status}`);
        }

        afterCommit(() =>
          publishEvent("task.updated", {
            projectId: integration.projectId,
            taskId: task.id,
          }),
        );
      },
    );

    return;
  }

  console.log(
    `[Push] No matching task found in any integrated project for branch: ${branchName}`,
  );
}
