import {
  createExternalLink,
  findExternalLink,
} from "../../github/services/link-manager";
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
import { extractTaskNumberGitea } from "../utils/branch-matcher";
import { resolveTargetStatus } from "../utils/resolve-column";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

type PROpenedPayload = {
  action: string;
  pull_request: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: string;
    draft?: boolean;
    merged?: boolean;
    head: {
      ref: string;
    };
    user: { login?: string; username?: string } | null;
  };
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

export async function handleGiteaPullRequestOpened(payload: PROpenedPayload) {
  const { pull_request, repository } = payload;

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) return;

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
    repository.name,
  );

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    const config = JSON.parse(integration.config) as GiteaConfig;
    const projectSlug = integration.project.slug;
    const branchName = pull_request.head.ref;

    const taskNumber = extractTaskNumberGitea(
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
        author: pull_request.user?.login ?? pull_request.user?.username,
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
