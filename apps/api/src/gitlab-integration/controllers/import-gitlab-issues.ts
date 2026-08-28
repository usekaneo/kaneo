import { and, eq, inArray, notInArray } from "drizzle-orm";
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
import { formatTaskDescriptionFromIssue } from "../../plugins/github/utils/format";
import type { GitlabConfig } from "../../plugins/gitlab/config";
import { extractTaskNumberGitlab } from "../../plugins/gitlab/utils/branch-matcher";
import {
  createGitlabClient,
  type GitlabIssue,
  type GitlabMergeRequest,
  type GitlabNote,
} from "../../plugins/gitlab/utils/gitlab-api";
import { claimTaskNumber } from "../../task/controllers/claim-task-numbers";

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors?: string[];
};

type GitlabClient = ReturnType<typeof createGitlabClient>;

const PAGE_SIZE = 100;

/**
 * `with_labels_details=true` turns the label array into objects; without it
 * GitLab returns bare strings. Both shapes have to be readable here.
 */
function issueLabels(
  issue: GitlabIssue,
): Array<{ name: string; color: string }> {
  return (issue.labels ?? []).map((label) =>
    typeof label === "string"
      ? { name: label, color: "#6B7280" }
      : {
          name: label.name,
          color: label.color ? `#${label.color.replace(/^#/, "")}` : "#6B7280",
        },
  );
}

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
  let page = 1;

  while (true) {
    const issues = await client.listIssues(page, "opened", PAGE_SIZE);
    if (issues.length === 0) break;
    allIssues.push(...issues);
    if (issues.length < PAGE_SIZE) break;
    page++;
  }

  for (const issue of allIssues) {
    try {
      const result = await importSingleIssue(
        issue,
        integration.id,
        projectId,
        project.workspaceId,
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
      errors.push(`Issue #${issue.iid}: ${errorMessage}`);
    }
  }

  const allMergeRequests: GitlabMergeRequest[] = [];
  page = 1;

  while (true) {
    const mrs = await client.listMergeRequests(page, "opened", PAGE_SIZE);
    if (mrs.length === 0) break;
    allMergeRequests.push(...mrs);
    if (mrs.length < PAGE_SIZE) break;
    page++;
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
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`MR !${mergeRequest.iid}: ${errorMessage}`);
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
  client: GitlabClient,
): Promise<"imported" | "updated" | "skipped"> {
  const existingLink = await findExternalLink(
    integrationId,
    "issue",
    issue.iid.toString(),
  );

  const labels = issueLabels(issue);
  const labelNames = labels.map((label) => label.name);
  const priority = extractIssuePriority(labelNames);
  const status = extractIssueStatus(labelNames);

  if (existingLink) {
    const updateData: Record<string, unknown> = {
      title: issue.title,
      description: formatTaskDescriptionFromIssue(issue.description),
    };

    if (priority) updateData.priority = priority;
    if (status) updateData.status = status;

    await db
      .update(taskTable)
      .set(updateData)
      .where(eq(taskTable.id, existingLink.taskId));

    await importLabelsForTask(labels, existingLink.taskId, workspaceId);
    await importNotesForTask(issue, existingLink.taskId, client);

    return "updated";
  }

  const createdTask = await db.transaction(async (tx) => {
    // The project's counter is the only allocator of task numbers; deriving
    // one from max(number) here would leave it behind and collide with the
    // next task the webhook creates.
    const nextNumber = await claimTaskNumber(projectId, tx);

    const taskValues: typeof taskTable.$inferInsert = {
      projectId,
      userId: null,
      title: issue.title,
      description: formatTaskDescriptionFromIssue(issue.description),
      status: status || "to-do",
      priority: priority ?? "low",
      number: nextNumber,
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
  await importNotesForTask(issue, createdTask.id, client);

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
  labels: Array<{ name: string; color: string }>,
  taskId: string,
  workspaceId: string,
): Promise<void> {
  const nonSystemLabels = labels.filter(
    (label) =>
      label.name &&
      !label.name.startsWith("priority:") &&
      !label.name.startsWith("status:"),
  );

  const expectedNames = nonSystemLabels.map((label) => label.name);

  if (expectedNames.length > 0) {
    await db
      .delete(labelTable)
      .where(
        and(
          eq(labelTable.taskId, taskId),
          notInArray(labelTable.name, expectedNames),
        ),
      );
  } else {
    await db.delete(labelTable).where(eq(labelTable.taskId, taskId));
  }

  const existingLabelsOnTask = await db.query.labelTable.findMany({
    where:
      expectedNames.length > 0
        ? and(
            eq(labelTable.taskId, taskId),
            inArray(labelTable.name, expectedNames),
          )
        : eq(labelTable.taskId, taskId),
  });

  for (const labelData of nonSystemLabels) {
    if (existingLabelsOnTask.some((label) => label.name === labelData.name)) {
      continue;
    }

    const existingWorkspaceLabel = await db.query.labelTable.findFirst({
      where: and(
        eq(labelTable.workspaceId, workspaceId),
        eq(labelTable.name, labelData.name),
      ),
    });

    await db
      .insert(labelTable)
      .values({
        name: labelData.name,
        color: existingWorkspaceLabel?.color || labelData.color,
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
  client: GitlabClient,
): Promise<void> {
  const allNotes: GitlabNote[] = [];
  let page = 1;

  while (true) {
    const notes = await client.listIssueNotes(issue.iid, page, PAGE_SIZE);
    if (notes.length === 0) break;
    allNotes.push(...notes);
    if (notes.length < PAGE_SIZE) break;
    page++;
  }

  for (const note of allNotes) {
    // System notes are GitLab's own activity feed, not user comments.
    if (note.system) {
      continue;
    }

    const username = note.author?.username ?? note.author?.name ?? "";
    if (username.endsWith("[bot]")) {
      continue;
    }

    await db
      .insert(activityTable)
      .values({
        taskId,
        type: "comment",
        content: note.body,
        externalUserName: username || "Unknown",
        externalUserAvatar: note.author?.avatar_url ?? null,
        externalSource: "gitlab",
        // The notes API returns no URL of its own; GitLab anchors a note on
        // the issue page by id.
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
}

async function linkMergeRequestToTask(
  mergeRequest: GitlabMergeRequest,
  integrationId: string,
  projectId: string,
  projectSlug: string,
  config: GitlabConfig,
): Promise<void> {
  const branch = mergeRequest.source_branch;
  if (!branch) {
    return;
  }

  const taskNumber = extractTaskNumberGitlab(
    branch,
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
      draft: mergeRequest.draft ?? mergeRequest.work_in_progress ?? false,
      branch,
      author: mergeRequest.author?.username ?? mergeRequest.author?.name,
    },
  });
}
