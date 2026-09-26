import { publishEvent } from "../../../events";
import type { GitHubConfig } from "../config";
import { createExternalLink, findExternalLink } from "../services/link-manager";
import { resolvePullRequestTask } from "../services/resolve-pull-request-task";
import {
  findAllIntegrationsByRepo,
  isTaskInFinalState,
  updateTaskStatus,
} from "../services/task-service";
import { resolveTargetStatus } from "../utils/resolve-column";

type PROpenedPayload = {
  action: string;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: string;
    draft: boolean;
    merged: boolean;
    head: {
      ref: string;
    };
    user: { login: string } | null;
  };
  installation?: { id: number };
  repository: {
    id: number;
    owner: { login: string };
    name: string;
  };
};

export async function handlePullRequestOpened(payload: PROpenedPayload) {
  const { pull_request, repository } = payload;

  const integrations = await findAllIntegrationsByRepo(payload);

  const candidates = [];
  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    const config = JSON.parse(integration.config) as GitHubConfig;
    const existingLink = await findExternalLink(
      integration.id,
      "pull_request",
      pull_request.number.toString(),
    );
    if (existingLink) return;

    const task = await resolvePullRequestTask({
      integrationId: integration.id,
      projectId: integration.projectId,
      projectSlug: integration.project.slug,
      config,
      repositoryUrl: `https://github.com/${repository.owner.login}/${repository.name}`,
      pullRequest: pull_request,
    });
    if (task) candidates.push({ integration, config, task });
  }

  const candidate = candidates[0];
  if (candidates.length !== 1 || !candidate) return;
  const { integration, config, task } = candidate;
  const branchName = pull_request.head.ref;

  await createExternalLink({
    taskId: task.id,
    integrationId: integration.id,
    resourceType: "pull_request",
    externalId: pull_request.number.toString(),
    url: pull_request.html_url,
    title: pull_request.title,
    metadata: {
      state: pull_request.state,
      draft: pull_request.draft,
      merged: pull_request.merged,
      branch: branchName,
      author: pull_request.user?.login,
    },
  });

  const targetStatus = await resolveTargetStatus(
    integration.projectId,
    "pr_opened",
    config.statusTransitions?.onPROpen || "in-review",
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
