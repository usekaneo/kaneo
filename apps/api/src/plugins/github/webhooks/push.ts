import { publishEvent } from "../../../events";
import type { GitHubConfig } from "../config";
import {
  createOrUpdateExternalLink,
  findExternalLink,
} from "../services/link-manager";
import {
  findAllIntegrationsByRepo,
  findTaskById,
  findTaskByNumber,
  isTaskInFinalState,
  updateTaskStatus,
} from "../services/task-service";
import { extractTaskNumberFromBranch } from "../utils/branch-matcher";
import { extractClosedIssueNumbersFromCommits } from "../utils/parse-close-keywords";
import { resolveTargetStatus } from "../utils/resolve-column";

type PushCommit = {
  id: string;
  message: string;
  author?: { name: string };
  timestamp: string;
};

type PushPayload = {
  ref: string;
  head_commit?: PushCommit;
  commits?: PushCommit[];
  repository: {
    owner: { login: string };
    name: string;
    html_url: string;
  };
};

type IntegrationWithProject = Awaited<
  ReturnType<typeof findAllIntegrationsByRepo>
>[number];

const PROTECTED_BRANCHES = [
  "main",
  "master",
  "develop",
  "staging",
  "production",
];

async function moveTaskToDone(
  task: NonNullable<Awaited<ReturnType<typeof findTaskById>>>,
  projectId: string,
) {
  if (await isTaskInFinalState(task)) {
    return;
  }

  const targetStatus = await resolveTargetStatus(
    projectId,
    "issue_closed",
    "done",
  );

  if (task.status === targetStatus) {
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
}

// A commit whose message says "closes #N" closes the task behind issue #N, on
// any branch. GitHub only applies closing keywords when the commit reaches the
// default branch, so Kaneo reacts to the same intent itself to make feature
// branches work. Moving the task to done drives the outbound sync that closes
// the GitHub issue; the inbound echo guard keeps that from bouncing back.
async function applyCommitCloses(
  integrations: IntegrationWithProject[],
  commits: PushCommit[],
) {
  const issueNumbers = extractClosedIssueNumbersFromCommits(commits);
  if (issueNumbers.length === 0) {
    return;
  }

  for (const integration of integrations) {
    if (!integration.project) {
      continue;
    }

    for (const issueNumber of issueNumbers) {
      const issueLink = await findExternalLink(
        integration.id,
        "issue",
        issueNumber.toString(),
      );

      if (!issueLink) {
        continue;
      }

      const task = await findTaskById(issueLink.taskId);
      if (!task) {
        continue;
      }

      console.log(
        `[Push] Commit closes issue #${issueNumber} -> task ${task.id}`,
      );
      await moveTaskToDone(task, integration.projectId);
    }
  }
}

export async function handlePush(payload: PushPayload) {
  const { ref, repository, head_commit } = payload;

  const branchName = ref.replace("refs/heads/", "");
  console.log(`[Push] Processing branch: ${branchName}`);

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

  // Closing keywords are honored on every branch, including protected ones.
  const commits =
    payload.commits && payload.commits.length > 0
      ? payload.commits
      : head_commit
        ? [head_commit]
        : [];
  await applyCommitCloses(integrations, commits);

  if (PROTECTED_BRANCHES.includes(branchName)) {
    console.log(
      `[Push] Skipping branch status transition for protected branch: ${branchName}`,
    );
    return;
  }

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
    } else {
      console.log(`[Push] Skipping status update - already ${task.status}`);
    }

    return;
  }

  console.log(
    `[Push] No matching task found in any integrated project for branch: ${branchName}`,
  );
}
