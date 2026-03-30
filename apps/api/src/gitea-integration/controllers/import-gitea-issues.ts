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
import type { GiteaConfig } from "../../plugins/gitea/config";
import { extractTaskNumberGitea } from "../../plugins/gitea/utils/branch-matcher";
import {
  createGiteaClient,
  type GiteaIssue,
} from "../../plugins/gitea/utils/gitea-api";
import {
  createExternalLink,
  findExternalLink,
} from "../../plugins/github/services/link-manager";
import { findTaskByNumber } from "../../plugins/github/services/task-service";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../plugins/github/utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../../plugins/github/utils/format";
import getNextTaskNumber from "../../task/controllers/get-next-task-number";

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors?: string[];
};

export async function importGiteaIssues(
  projectId: string,
): Promise<ImportResult> {
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
      eq(integrationTable.type, "gitea"),
    ),
  });

  if (!integration) {
    throw new HTTPException(404, { message: "Gitea integration not found" });
  }

  if (!integration.isActive) {
    throw new HTTPException(400, {
      message: "Gitea integration is not active",
    });
  }

  const config = JSON.parse(integration.config) as GiteaConfig;

  if (!config.accessToken || !config.baseUrl) {
    throw new HTTPException(400, {
      message: "Gitea access token or base URL not configured",
    });
  }

  const client = createGiteaClient(config);

  const allIssues: GiteaIssue[] = [];
  let page = 1;

  while (true) {
    const issues = await client.listIssues(
      config.repositoryOwner,
      config.repositoryName,
      page,
      "open",
    );

    if (issues.length === 0) break;

    const issuesOnly = issues.filter((issue) => !issue.pull_request);
    allIssues.push(...issuesOnly);

    if (issues.length < 100) break;
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
        client,
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

  const allPRs: Array<{
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: string;
    head: { ref: string };
    user?: { login?: string; username?: string; avatar_url?: string } | null;
  }> = [];
  page = 1;

  while (true) {
    const pulls = await client.listPulls(
      config.repositoryOwner,
      config.repositoryName,
      page,
    );

    if (pulls.length === 0) break;

    allPRs.push(...pulls);

    if (pulls.length < 100) break;
    page++;
  }

  for (const pr of allPRs) {
    try {
      if (!pr.head?.ref) {
        continue;
      }
      await linkPullRequestToTask(
        {
          ...pr,
          head: { ref: pr.head.ref },
        },
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
  issue: GiteaIssue,
  integrationId: string,
  projectId: string,
  workspaceId: string,
  config: GiteaConfig,
  client: ReturnType<typeof createGiteaClient>,
): Promise<"imported" | "updated" | "skipped"> {
  const existingLink = await findExternalLink(
    integrationId,
    "issue",
    issue.number.toString(),
  );

  const labels = issue.labels ?? [];
  const priority = extractIssuePriority(labels as never);
  const status = extractIssueStatus(labels as never);

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

    await importLabelsForTask(labels, existingLink.taskId, workspaceId);

    await importCommentsForTask(
      issue.number,
      existingLink.taskId,
      config,
      client,
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
      createdFrom: "gitea-import",
      author: issue.user?.login ?? issue.user?.username,
    },
  });

  await importLabelsForTask(labels, createdTask.id, workspaceId);

  await importCommentsForTask(issue.number, createdTask.id, config, client);

  return "imported";
}

async function importLabelsForTask(
  issueLabels: GiteaIssue["labels"],
  taskId: string,
  workspaceId: string,
): Promise<void> {
  const nonSystemLabels = (issueLabels ?? [])
    .map((label) => {
      if (typeof label === "string") {
        return { name: label, color: "#6B7280" };
      }
      return {
        name: label.name,
        color: label.color
          ? `#${String(label.color).replace(/^#/, "")}`
          : "#6B7280",
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
  config: GiteaConfig,
  client: ReturnType<typeof createGiteaClient>,
): Promise<void> {
  const allComments: Array<{
    body: string;
    html_url: string;
    user?: { login?: string; username?: string; avatar_url?: string } | null;
  }> = [];
  let page = 1;

  while (true) {
    const comments = await client.listIssueComments(
      config.repositoryOwner,
      config.repositoryName,
      issueNumber,
      page,
      100,
    );

    if (comments.length === 0) break;

    allComments.push(...comments);

    if (comments.length < 100) break;
    page++;
  }

  const existingActivities = await db.query.activityTable.findMany({
    where: and(
      eq(activityTable.taskId, taskId),
      eq(activityTable.externalSource, "gitea"),
    ),
  });

  const existingExternalUrls = new Set(
    existingActivities.filter((a) => a.externalUrl).map((a) => a.externalUrl),
  );

  for (const comment of allComments) {
    const username = comment.user?.login ?? comment.user?.username ?? "";
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
      externalUserName: username || "Unknown",
      externalUserAvatar: comment.user?.avatar_url ?? null,
      externalSource: "gitea",
      externalUrl: comment.html_url,
    });
  }
}

async function linkPullRequestToTask(
  pr: {
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    state: string;
    head: { ref: string };
    user?: { login?: string; username?: string; avatar_url?: string } | null;
  },
  integrationId: string,
  projectId: string,
  projectSlug: string,
  config: GiteaConfig,
): Promise<void> {
  const taskNumber = extractTaskNumberGitea(
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
      author: pr.user?.login ?? pr.user?.username,
    },
  });
}
