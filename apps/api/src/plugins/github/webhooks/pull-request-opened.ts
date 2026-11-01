import { and, eq, inArray } from "drizzle-orm";
import db, { schema } from "../../../database";
import { withIntegrationTask } from "../services/integration-task-scope";
import { publishEvent } from "../../../events";
import type { GitHubConfig } from "../config";
import { createExternalLink, findExternalLink } from "../services/link-manager";
import { resolvePullRequestTask } from "../services/resolve-pull-request-task";
import {
  findAllIntegrationsByRepo,
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
      sha?: string;
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
  // A server-created coding branch has an approved task/integration binding.
  // Use it for both direct completion and the ordinary GitHub webhook; generic
  // branch patterns can be ambiguous across workspaces or unnumbered tasks.
  const codeJob =
    /-kaneo-[a-z0-9]{6}$/.test(pull_request.head.ref) &&
    pull_request.head.sha &&
    integrations.length
      ? await db.query.agentJobTable.findFirst({
          columns: { taskId: true, integrationId: true },
          where: and(
            eq(schema.agentJobTable.branch, pull_request.head.ref),
            eq(schema.agentJobTable.commitSha, pull_request.head.sha),
            eq(schema.agentJobTable.repositoryId, repository.id),
            inArray(
              schema.agentJobTable.integrationId,
              integrations.map((integration) => integration.id),
            ),
            inArray(schema.agentJobTable.status, ["committing", "completed"]),
          ),
        })
      : undefined;

  if (codeJob && !codeJob.taskId) return;
  const candidates = [];
  for (const integration of integrations) {
    if (codeJob && integration.id !== codeJob.integrationId) continue;
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
      expectedTaskId: codeJob?.taskId ?? undefined,
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

  await withIntegrationTask(
    task.id,
    integration,
    async (database, afterCommit) => {
      const currentTask = await resolvePullRequestTask({
        expectedTaskId: codeJob?.taskId ?? undefined,
        integrationId: integration.id,
        projectId: integration.projectId,
        projectSlug: integration.project.slug,
        config,
        repositoryUrl: `https://github.com/${repository.owner.login}/${repository.name}`,
        pullRequest: pull_request,
        database,
      });
      if (currentTask?.id !== task.id) return;
      if (
        await findExternalLink(
          integration.id,
          "pull_request",
          pull_request.number.toString(),
          database,
        )
      )
        return;
      await createExternalLink(
        {
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
        },
        database,
      );

      afterCommit(() =>
        publishEvent("integration.pr_opened", {
          taskId: task.id,
          projectId: integration.projectId,
          eventId: `${integration.id}:pr_opened:${pull_request.number}`,
          pullRequest: {
            number: pull_request.number,
            title: pull_request.title,
            url: pull_request.html_url,
          },
        }),
      );

      afterCommit(() =>
        publishEvent("task.updated", {
          projectId: integration.projectId,
          taskId: task.id,
        }),
      );

      const targetStatus = await resolveTargetStatus(
        integration.projectId,
        "pr_opened",
        config.statusTransitions?.onPROpen || "in-review",
        database,
      );

      if (currentTask.status !== targetStatus) {
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
      }
    },
  );
}
