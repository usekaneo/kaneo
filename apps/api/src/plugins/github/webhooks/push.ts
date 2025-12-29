import type { GitHubConfig } from "../config";
import { createOrUpdateExternalLink } from "../services/link-manager";
import {
  findIntegrationByRepo,
  findTaskByNumber,
  updateTaskStatus,
} from "../services/task-service";
import { extractTaskNumberFromBranch } from "../utils/branch-matcher";

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

  if (PROTECTED_BRANCHES.includes(branchName)) {
    return;
  }

  const integration = await findIntegrationByRepo(
    repository.owner.login,
    repository.name,
  );

  if (!integration || !integration.project) {
    return;
  }

  const config = JSON.parse(integration.config) as GitHubConfig;
  const projectSlug = integration.project.slug;

  const taskNumber = extractTaskNumberFromBranch(
    branchName,
    config,
    projectSlug,
  );

  if (!taskNumber) {
    return;
  }

  const task = await findTaskByNumber(integration.projectId, taskNumber);

  if (!task) {
    return;
  }

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

  const targetStatus = config.statusTransitions?.onBranchPush || "in-progress";

  if (task.status !== targetStatus && task.status !== "done") {
    await updateTaskStatus(task.id, targetStatus);
  }
}
