import { publishEvent } from "../../../events";
import { createOrUpdateExternalLink } from "../../github/services/link-manager";
import {
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../../github/services/task-service";
import type { GiteaConfig } from "../config";
import {
  findAllIntegrationsByGiteaRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import { extractTaskNumberFromBranchGitea } from "../utils/branch-matcher";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

type PushPayload = {
  ref: string;
  head_commit?: {
    id: string;
    message: string;
    author?: { name: string };
    timestamp: string;
  };
  commits?: Array<{
    id: string;
    message: string;
    author?: { name: string; username?: string };
    timestamp?: string;
  }>;
  repository: {
    owner: { login?: string; username?: string };
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

export async function handleGiteaPush(payload: PushPayload) {
  const { ref, repository } = payload;

  if (!ref.startsWith("refs/heads/")) {
    console.log(`[Gitea Push] Skipping non-branch ref: ${ref}`);
    return;
  }

  const branchName = ref.slice("refs/heads/".length);
  console.log(`[Gitea Push] Processing branch: ${branchName}`);

  if (PROTECTED_BRANCHES.includes(branchName)) {
    console.log(`[Gitea Push] Skipping protected branch: ${branchName}`);
    return;
  }

  const origin = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!origin) {
    return;
  }
  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    origin,
    owner,
    repository.name,
  );

  if (integrations.length === 0) {
    return;
  }

  const headCommit =
    payload.head_commit ?? payload.commits?.[payload.commits.length - 1];

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    let config: GiteaConfig;
    try {
      config = JSON.parse(integration.config) as GiteaConfig;
    } catch (error) {
      console.error("Invalid Gitea integration config for push webhook", {
        integrationId: integration.id,
        error,
      });
      continue;
    }
    const projectSlug = integration.project.slug;

    const taskNumber = extractTaskNumberFromBranchGitea(
      branchName,
      config,
      projectSlug,
    );

    if (!taskNumber) {
      continue;
    }

    const task = await findTaskByNumber(integration.projectId, taskNumber);

    if (!task) {
      continue;
    }

    const treeUrl = `${repository.html_url}/src/branch/${branchName}`;

    await createOrUpdateExternalLink({
      taskId: task.id,
      integrationId: integration.id,
      resourceType: "branch",
      externalId: branchName,
      url: treeUrl,
      title: branchName,
      metadata: {
        lastCommit: headCommit
          ? {
              sha: headCommit.id,
              message: headCommit.message,
              author: headCommit.author?.name,
              timestamp:
                "timestamp" in headCommit ? headCommit.timestamp : undefined,
            }
          : null,
      },
    });

    const targetStatus = await resolveTargetStatus(
      integration.projectId,
      "branch_push",
      config.statusTransitions?.onBranchPush || "in-progress",
    );

    const isTaskFinal = await isTaskInFinalState(task);

    if (task.status !== targetStatus && !isTaskFinal) {
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
}
