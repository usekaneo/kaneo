import { and, eq, inArray, max, notInArray } from "drizzle-orm";
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
} from "../../plugins/gitlab/utils/gitlab-api";

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors?: string[];
};

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

  // GitLab issue payloads carry label names only, with no color — resolve
  // colors once per project instead of once per issue.
  let labelColors = new Map<string, string>();
  try {
    const projectLabels = await client.listLabels(config.repositoryPath);
    labelColors = new Map(
      projectLabels.map((l) => [l.name, l.color ?? "#6B7280"]),
    );
  } catch (error) {
    console.warn("Failed to list GitLab labels for import; using defaults", {
      repositoryPath: config.repositoryPath,
      error,
    });
  }

  const allIssues: GitlabIssue[] = [];
  let page = 1;

  while (true) {
    const issues = await client.listIssues(
      config.repositoryPath,
      page,
      "opened",
    );

    if (issues.length === 0) break;

    allIssues.push(...issues);

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
        labelColors,
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

  const allMRs: GitlabMergeRequest[] = [];
  page = 1;

  while (true) {
    const mrs = await client.listMergeRequests(config.repositoryPath, page);

    if (mrs.length === 0) break;

    allMRs.push(...mrs);

    if (mrs.length < 100) break;
    page++;
  }

  for (const mr of allMRs) {
    try {
      if (!mr.source_branch) {
        continue;
      }
      await linkMergeRequestToTask(
        mr,
        integration.id,
        projectId,
        project.slug,
        config,
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      errors.push(`MR !${mr.iid}: ${errorMessage}`);
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
  client: ReturnType<typeof createGitlabClient>,
  labelColors: Map<string, string>,
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
      description: formatTaskDescriptionFromIssue(issue.description),
    };

    if (priority) updateData.priority = priority;
    if (status) updateData.status = status;

    await db
      .update(taskTable)
      .set(updateData)
      .where(eq(taskTable.id, existingLink.taskId));

    await importLabelsForTask(
      labels,
      labelColors,
      existingLink.taskId,
      workspaceId,
    );
    await importNotesForTask(issue.iid, existingLink.taskId, config, client);

    return "updated";
  }

  const createdTask = await db.transaction(async (tx) => {
    const [lockedProject] = await tx
      .select()
      .from(projectTable)
      .where(eq(projectTable.id, projectId))
      .for("update");

    if (!lockedProject) {
      throw new Error("Project not found");
    }

    const [result] = await tx
      .select({ maxNumber: max(taskTable.number) })
      .from(taskTable)
      .where(eq(taskTable.projectId, projectId));

    const nextNumber = (result?.maxNumber ?? 0) + 1;

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
      author: issue.author?.username,
    },
  });

  await importLabelsForTask(labels, labelColors, createdTask.id, workspaceId);
  await importNotesForTask(issue.iid, createdTask.id, config, client);

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
  labelNames: string[],
  labelColors: Map<string, string>,
  taskId: string,
  workspaceId: string,
): Promise<void> {
  const nonSystemLabels = labelNames
    .filter(
      (name) => !name.startsWith("priority:") && !name.startsWith("status:"),
    )
    .map((name) => ({
      name,
      color: labelColors.get(name) ?? "#6B7280",
    }));

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
    const existingLabelOnTask = existingLabelsOnTask.find(
      (label) => label.name === labelData.name,
    );

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

    await db
      .insert(labelTable)
      .values({
        name: labelData.name,
        color: colorToUse,
        taskId,
        workspaceId,
      })
      .onConflictDoNothing({
        target: [labelTable.taskId, labelTable.name],
      });
  }
}

async function importNotesForTask(
  issueIid: number,
  taskId: string,
  config: GitlabConfig,
  client: ReturnType<typeof createGitlabClient>,
): Promise<void> {
  const allNotes: Array<{
    id: number;
    body: string;
    author?: { username?: string; avatar_url?: string } | null;
  }> = [];
  let page = 1;

  while (true) {
    const notes = await client.listIssueNotes(
      config.repositoryPath,
      issueIid,
      page,
      100,
    );

    if (notes.length === 0) break;

    allNotes.push(...notes);

    if (notes.length < 100) break;
    page++;
  }

  for (const note of allNotes) {
    const username = note.author?.username ?? "";
    if (username.endsWith("-bot") || username.endsWith("[bot]")) {
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
        externalUrl: `${config.baseUrl}/${config.repositoryPath}/-/issues/${issueIid}#note_${note.id}`,
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
  mr: GitlabMergeRequest,
  integrationId: string,
  projectId: string,
  projectSlug: string,
  config: GitlabConfig,
): Promise<void> {
  const taskNumber = extractTaskNumberGitlab(
    mr.source_branch,
    mr.title,
    mr.description ?? undefined,
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
    mr.iid.toString(),
  );

  if (existingLink) {
    return;
  }

  await createExternalLink({
    taskId: task.id,
    integrationId,
    resourceType: "pull_request",
    externalId: mr.iid.toString(),
    url: mr.web_url,
    title: mr.title,
    metadata: {
      state: mr.state,
      branch: mr.source_branch,
      author: mr.author?.username,
    },
  });
}
