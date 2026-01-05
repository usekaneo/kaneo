import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  integrationTable,
  labelTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import type { GitHubConfig } from "../../plugins/github/config";
import {
  createExternalLink,
  findExternalLink,
} from "../../plugins/github/services/link-manager";
import { findTaskByNumber } from "../../plugins/github/services/task-service";
import { extractTaskNumber } from "../../plugins/github/utils/branch-matcher";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../plugins/github/utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../../plugins/github/utils/format";
import { getInstallationOctokit } from "../../plugins/github/utils/github-app";
import getNextTaskNumber from "../../task/controllers/get-next-task-number";

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors?: string[];
};

type GitHubIssue = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  labels: Array<{ name?: string; color?: string } | string>;
  user: { login: string; avatar_url: string } | null;
  pull_request?: unknown;
};

type GitHubComment = {
  id: number;
  body: string;
  html_url: string;
  user: { login: string; avatar_url: string } | null;
  created_at: string;
};

type GitHubPullRequest = {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  state: string;
  head: { ref: string };
  user: { login: string; avatar_url: string } | null;
};

export async function importIssues(projectId: string): Promise<ImportResult> {
  const errors: string[] = [];
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  const project = await db.query.projectTable.findFirst({
    where: eq(projectTable.id, projectId),
  });

  if (!project) {
    throw new HTTPException(404, { message: "Project not found" });
  }

  const integration = await db.query.integrationTable.findFirst({
    where: and(
      eq(integrationTable.projectId, projectId),
      eq(integrationTable.type, "github"),
    ),
  });

  if (!integration) {
    throw new HTTPException(404, { message: "GitHub integration not found" });
  }

  if (!integration.isActive) {
    throw new HTTPException(400, {
      message: "GitHub integration is not active",
    });
  }

  const config = JSON.parse(integration.config) as GitHubConfig;

  if (!config.installationId) {
    throw new HTTPException(400, {
      message: "GitHub installation ID not configured",
    });
  }

  const octokit = await getInstallationOctokit(config.installationId);

  const allIssues: GitHubIssue[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data: issues } = await octokit.rest.issues.listForRepo({
      owner: config.repositoryOwner,
      repo: config.repositoryName,
      state: "open",
      per_page: perPage,
      page,
    });

    if (issues.length === 0) break;

    const issuesOnly = issues.filter(
      (issue) => !issue.pull_request,
    ) as GitHubIssue[];
    allIssues.push(...issuesOnly);

    if (issues.length < perPage) break;
    page++;
  }

  for (const issue of allIssues) {
    try {
      const result = await importSingleIssue(
        issue,
        integration.id,
        projectId,
        project.workspaceId,
        config,
        octokit,
      );

      if (result === "imported") {
        imported++;
      } else if (result === "updated") {
        updated++;
      } else {
        skipped++;
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`Issue #${issue.number}: ${errorMessage}`);
    }
  }

  const allPRs: GitHubPullRequest[] = [];
  page = 1;

  while (true) {
    const { data: pulls } = await octokit.rest.pulls.list({
      owner: config.repositoryOwner,
      repo: config.repositoryName,
      state: "open",
      per_page: perPage,
      page,
    });

    if (pulls.length === 0) break;

    allPRs.push(...(pulls as GitHubPullRequest[]));

    if (pulls.length < perPage) break;
    page++;
  }

  for (const pr of allPRs) {
    try {
      await linkPullRequestToTask(
        pr,
        integration.id,
        projectId,
        project.slug,
        config,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`PR #${pr.number}: ${errorMessage}`);
    }
  }

  return {
    imported,
    updated,
    skipped,
    ...(errors.length > 0 ? { errors } : {}),
  };
}

async function importSingleIssue(
  issue: GitHubIssue,
  integrationId: string,
  projectId: string,
  workspaceId: string,
  config: GitHubConfig,
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
): Promise<"imported" | "updated" | "skipped"> {
  const existingLink = await findExternalLink(
    integrationId,
    "issue",
    issue.number.toString(),
  );

  const priority = extractIssuePriority(issue.labels);
  const status = extractIssueStatus(issue.labels);

  if (existingLink) {
    const updateData: Record<string, unknown> = {
      title: issue.title,
      description: formatTaskDescriptionFromIssue(issue.body),
    };

    if (priority) updateData.priority = priority;
    if (status) updateData.status = status;

    await db
      .update(taskTable)
      .set(updateData)
      .where(eq(taskTable.id, existingLink.taskId));

    await importLabelsForTask(issue.labels, existingLink.taskId, workspaceId);

    await importCommentsForTask(
      issue.number,
      existingLink.taskId,
      config,
      octokit,
    );

    return "updated";
  }

  const nextTaskNumber = await getNextTaskNumber(projectId);

  const taskValues: typeof taskTable.$inferInsert = {
    projectId,
    userId: null,
    title: issue.title,
    description: formatTaskDescriptionFromIssue(issue.body),
    status: status || "to-do",
    priority: priority || null,
    number: nextTaskNumber + 1,
  };

  const [createdTask] = await db
    .insert(taskTable)
    .values(taskValues)
    .returning();

  if (!createdTask) {
    throw new Error("Failed to create task");
  }

  await createExternalLink({
    taskId: createdTask.id,
    integrationId,
    resourceType: "issue",
    externalId: issue.number.toString(),
    url: issue.html_url,
    title: issue.title,
    metadata: {
      state: issue.state,
      createdFrom: "github-import",
      author: issue.user?.login,
    },
  });

  await importLabelsForTask(issue.labels, createdTask.id, workspaceId);

  await importCommentsForTask(issue.number, createdTask.id, config, octokit);

  return "imported";
}

async function importLabelsForTask(
  issueLabels: GitHubIssue["labels"],
  taskId: string,
  workspaceId: string,
): Promise<void> {
  const nonSystemLabels = issueLabels
    .map((label) => {
      if (typeof label === "string") {
        return { name: label, color: "#6B7280" };
      }
      return {
        name: label.name,
        color: label.color ? `#${label.color}` : "#6B7280",
      };
    })
    .filter(
      (label) =>
        label.name &&
        !label.name.startsWith("priority:") &&
        !label.name.startsWith("status:"),
    ) as Array<{ name: string; color: string }>;

  for (const labelData of nonSystemLabels) {
    const existingLabelOnTask = await db.query.labelTable.findFirst({
      where: and(
        eq(labelTable.taskId, taskId),
        eq(labelTable.name, labelData.name),
      ),
    });

    if (existingLabelOnTask) {
      continue;
    }

    const existingWorkspaceLabel = await db.query.labelTable.findFirst({
      where: and(
        eq(labelTable.workspaceId, workspaceId),
        eq(labelTable.name, labelData.name),
      ),
    });

    const colorToUse = existingWorkspaceLabel?.color || labelData.color;

    await db.insert(labelTable).values({
      name: labelData.name,
      color: colorToUse,
      taskId,
      workspaceId,
    });
  }
}

async function importCommentsForTask(
  issueNumber: number,
  taskId: string,
  config: GitHubConfig,
  octokit: Awaited<ReturnType<typeof getInstallationOctokit>>,
): Promise<void> {
  const allComments: GitHubComment[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data: comments } = await octokit.rest.issues.listComments({
      owner: config.repositoryOwner,
      repo: config.repositoryName,
      issue_number: issueNumber,
      per_page: perPage,
      page,
    });

    if (comments.length === 0) break;

    allComments.push(...(comments as GitHubComment[]));

    if (comments.length < perPage) break;
    page++;
  }

  const existingActivities = await db.query.activityTable.findMany({
    where: and(
      eq(activityTable.taskId, taskId),
      eq(activityTable.externalSource, "github"),
    ),
  });

  const existingExternalUrls = new Set(
    existingActivities.filter((a) => a.externalUrl).map((a) => a.externalUrl),
  );

  for (const comment of allComments) {
    const username = comment.user?.login ?? "";
    if (username.endsWith("[bot]")) {
      continue;
    }

    if (existingExternalUrls.has(comment.html_url)) {
      continue;
    }

    await db.insert(activityTable).values({
      taskId,
      type: "comment",
      content: comment.body,
      externalUserName: comment.user?.login ?? "Unknown",
      externalUserAvatar: comment.user?.avatar_url ?? null,
      externalSource: "github",
      externalUrl: comment.html_url,
    });
  }
}

async function linkPullRequestToTask(
  pr: GitHubPullRequest,
  integrationId: string,
  projectId: string,
  projectSlug: string,
  config: GitHubConfig,
): Promise<void> {
  const taskNumber = extractTaskNumber(
    pr.head.ref,
    pr.title,
    pr.body ?? undefined,
    config,
    projectSlug,
  );

  if (!taskNumber) {
    return;
  }

  const task = await findTaskByNumber(projectId, taskNumber);

  if (!task) {
    return;
  }

  const existingLink = await findExternalLink(
    integrationId,
    "pull_request",
    pr.number.toString(),
  );

  if (existingLink) {
    return;
  }

  await createExternalLink({
    taskId: task.id,
    integrationId,
    resourceType: "pull_request",
    externalId: pr.number.toString(),
    url: pr.html_url,
    title: pr.title,
    metadata: {
      state: pr.state,
      branch: pr.head.ref,
      author: pr.user?.login,
    },
  });
}
