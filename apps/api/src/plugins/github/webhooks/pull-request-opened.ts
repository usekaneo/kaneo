import type { GitHubConfig } from "../config";
import { createExternalLink, findExternalLink } from "../services/link-manager";
import {
  findAllIntegrationsByRepo,
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../services/task-service";
import { extractTaskNumber } from "../utils/branch-matcher";
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
  repository: {
    owner: { login: string };
    name: string;
  };
};

export async function handlePullRequestOpened(payload: PROpenedPayload) {
  const { pull_request, repository } = payload;

  const integrations = await findAllIntegrationsByRepo(
    repository.owner.login,
    repository.name,
  );

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    const config = JSON.parse(integration.config) as GitHubConfig;
    const projectSlug = integration.project.slug;
    const branchName = pull_request.head.ref;

    const taskNumber = extractTaskNumber(
      branchName,
      pull_request.title,
      pull_request.body ?? undefined,
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

    const existingLink = await findExternalLink(
      integration.id,
      "pull_request",
      pull_request.number.toString(),
    );

    if (existingLink) {
      continue;
    }

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
      await updateTaskStatus(task.id, targetStatus);
    }

    return;
  }
}
