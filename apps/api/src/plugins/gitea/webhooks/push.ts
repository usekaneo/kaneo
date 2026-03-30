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

  const branchName = ref.replace("refs/heads/", "");
  console.log(`[Gitea Push] Processing branch: ${branchName}`);

  if (PROTECTED_BRANCHES.includes(branchName)) {
    console.log(`[Gitea Push] Skipping protected branch: ${branchName}`);
    return;
  }

  const baseUrl = new URL(repository.html_url);
  const origin = `${baseUrl.protocol}//${baseUrl.host}`;
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

    const config = JSON.parse(integration.config) as GiteaConfig;
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
      await updateTaskStatus(task.id, targetStatus);
    }

    return;
  }
}
