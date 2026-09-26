import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  integrationTable,
  labelTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import {
  createExternalLink,
  findExternalLink,
} from "../../plugins/github/services/link-manager";
import { findTaskByNumber } from "../../plugins/github/services/task-service";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../plugins/github/utils/extract-priority";
import type { GitlabConfig } from "../../plugins/gitlab/config";
import { extractTaskNumberGitlab } from "../../plugins/gitlab/utils/branch-matcher";
import {
  createGitlabClient,
  type GitlabIssue,
  type GitlabMergeRequest,
} from "../../plugins/gitlab/utils/gitlab-api";
import { taskDescriptionFromIssue } from "../../plugins/gitlab/utils/issue-description";
import { isSystemLabelName } from "../../plugins/gitlab/utils/system-labels";
import { claimTaskNumber } from "../../task/controllers/claim-task-numbers";

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors?: string[];
};

type GitlabClient = ReturnType<typeof createGitlabClient>;

const PER_PAGE = 100;
const MAX_PAGES = 50;

export async function importGitlabIssues(
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
      eq(integrationTable.type, "gitlab"),
    ),
  });

  if (!integration) {
    throw new HTTPException(404, { message: "GitLab integration not found" });
  }

  if (!integration.isActive) {
    throw new HTTPException(400, {
      message: "GitLab integration is not active",
    });
  }

  let config: GitlabConfig;
  try {
    config = JSON.parse(integration.config) as GitlabConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Invalid GitLab integration config JSON", {
      integrationId: integration.id,
      error,
    });
    throw new HTTPException(400, {
      message: `Invalid GitLab integration config: ${message}`,
    });
  }

  if (!config.accessToken || !config.baseUrl) {
    throw new HTTPException(400, {
      message: "GitLab access token or base URL not configured",
    });
  }

  const client = createGitlabClient(config);

  const allIssues: GitlabIssue[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const issues = await client.listIssues(config.projectPath, page, "opened");
    if (issues.length === 0) break;
    allIssues.push(...issues);
    if (issues.length < PER_PAGE) break;
  }

  for (const issue of allIssues) {
    // Confidential issues are skipped, same as in the webhook.
    if (issue.confidential) {
      skipped++;
      continue;
    }

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
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Issue !${issue.iid}: ${message}`);
    }
  }

  const allMergeRequests: GitlabMergeRequest[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const mergeRequests = await client.listMergeRequests(
      config.projectPath,
      page,
    );
    if (mergeRequests.length === 0) break;
    allMergeRequests.push(...mergeRequests);
    if (mergeRequests.length < PER_PAGE) break;
  }

  for (const mergeRequest of allMergeRequests) {
    try {
      await linkMergeRequestToTask(
        mergeRequest,
        integration.id,
        projectId,
        project.slug,
        config,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`Merge request !${mergeRequest.iid}: ${message}`);
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
  issue: GitlabIssue,
  integrationId: string,
  projectId: string,
  workspaceId: string,
  config: GitlabConfig,
  client: GitlabClient,
): Promise<"imported" | "updated" | "skipped"> {
  const existingLink = await findExternalLink(
    integrationId,
    "issue",
    issue.iid.toString(),
  );

  const labels = issue.labels ?? [];
  const priority = extractIssuePriority(labels);
  const status = extractIssueStatus(labels);

  if (existingLink) {
    const updateData: Record<string, unknown> = {
      title: issue.title,
      description: taskDescriptionFromIssue(issue.description),
    };

    if (priority) updateData.priority = priority;
    if (status) updateData.status = status;

    await db
      .update(taskTable)
      .set(updateData)
      .where(eq(taskTable.id, existingLink.taskId));

    await importLabelsForTask(labels, existingLink.taskId, workspaceId);
    await importNotesForTask(issue, existingLink.taskId, config, client);

    return "updated";
  }

  const createdTask = await db.transaction(async (tx) => {
    const number = await claimTaskNumber(projectId, tx);

    const taskValues: typeof taskTable.$inferInsert = {
      projectId,
      userId: null,
      title: issue.title,
      description: taskDescriptionFromIssue(issue.description),
      status: status || "to-do",
      priority: priority ?? "low",
      number,
    };

    const [created] = await tx.insert(taskTable).values(taskValues).returning();

    if (!created) {
      throw new Error("Failed to create task");
    }

    return created;
  });

  await createExternalLink({
    taskId: createdTask.id,
    integrationId,
    resourceType: "issue",
    externalId: issue.iid.toString(),
    url: issue.web_url,
    title: issue.title,
    metadata: {
      state: issue.state,
      createdFrom: "gitlab-import",
      author: issue.author?.username ?? issue.author?.name,
    },
  });

  await importLabelsForTask(labels, createdTask.id, workspaceId);
  await importNotesForTask(issue, createdTask.id, config, client);

  await publishEvent("task.created", {
    ...createdTask,
    taskId: createdTask.id,
    userId: createdTask.userId ?? "",
    type: "task",
    content: null,
    source: "gitlab-import",
    integrationId,
    externalId: issue.iid.toString(),
  });

  return "imported";
}

async function importLabelsForTask(
  issueLabels: string[],
  taskId: string,
  workspaceId: string,
): Promise<void> {
  const names = issueLabels.filter((name) => name && !isSystemLabelName(name));

  // GitLab issue, so its absence there is not a reason to remove labels.
  if (names.length === 0) {
    return;
  }

  const existingLabelsOnTask = await db.query.labelTable.findMany({
    where: and(eq(labelTable.taskId, taskId), inArray(labelTable.name, names)),
  });

  for (const name of names) {
    if (existingLabelsOnTask.some((label) => label.name === name)) {
      continue;
    }

    const existingWorkspaceLabel = await db.query.labelTable.findFirst({
      where: and(
        eq(labelTable.workspaceId, workspaceId),
        eq(labelTable.name, name),
      ),
    });

    await db
      .insert(labelTable)
      .values({
        name,
        color: existingWorkspaceLabel?.color || "#6B7280",
        taskId,
        workspaceId,
      })
      .onConflictDoNothing({
        target: [labelTable.taskId, labelTable.name],
      });
  }
}

async function importNotesForTask(
  issue: GitlabIssue,
  taskId: string,
  config: GitlabConfig,
  client: GitlabClient,
): Promise<void> {
  for (let page = 1; page <= MAX_PAGES; page++) {
    const notes = await client.listIssueNotes(
      config.projectPath,
      issue.iid,
      page,
      PER_PAGE,
    );

    if (notes.length === 0) break;

    for (const note of notes) {
      // Skip system notes (label/state changes) and internal notes.
      if (note.system || note.internal) {
        continue;
      }

      const username = note.author?.username ?? note.author?.name ?? "";

      await db
        .insert(activityTable)
        .values({
          taskId,
          type: "comment",
          content: note.body,
          externalUserName: username || "Unknown",
          externalUserAvatar: note.author?.avatar_url ?? null,
          externalSource: "gitlab",
          // The notes API has no URL, so link to the anchor on the issue page.
          externalUrl: `${issue.web_url}#note_${note.id}`,
          eventData: {
            externalCommentId: note.id,
          },
        })
        .onConflictDoNothing({
          target: [
            activityTable.taskId,
            activityTable.externalSource,
            activityTable.externalUrl,
          ],
        });
    }

    if (notes.length < PER_PAGE) break;
  }
}

async function linkMergeRequestToTask(
  mergeRequest: GitlabMergeRequest,
  integrationId: string,
  projectId: string,
  projectSlug: string,
  config: GitlabConfig,
): Promise<void> {
  const branchName = mergeRequest.source_branch;

  if (!branchName) {
    return;
  }

  const taskNumber = extractTaskNumberGitlab(
    branchName,
    mergeRequest.title,
    mergeRequest.description ?? undefined,
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
    mergeRequest.iid.toString(),
  );

  if (existingLink) {
    return;
  }

  await createExternalLink({
    taskId: task.id,
    integrationId,
    resourceType: "pull_request",
    externalId: mergeRequest.iid.toString(),
    url: mergeRequest.web_url,
    title: mergeRequest.title,
    metadata: {
      state: mergeRequest.state,
      draft: mergeRequest.draft === true,
      merged: false,
      branch: branchName,
      author: mergeRequest.author?.username ?? mergeRequest.author?.name,
    },
  });
}
