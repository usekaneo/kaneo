import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  externalLinkTable,
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
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../plugins/github/utils/extract-priority";
import type { GitlabConfig } from "../../plugins/gitlab/config";
import { resolveMergeRequestTask } from "../../plugins/gitlab/services/resolve-merge-request-task";
import {
  createGitlabClient,
  type GitlabIssue,
  type GitlabNote,
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
import {
  type IntegrationDatabase,
  linkedTaskScope,
  withIntegrationTask,
} from "../../plugins/github/services/integration-task-scope";

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

  const notes = await fetchIssueNotes(issue, config, client);

  if (existingLink) {
    const result = await withIntegrationTask(
      existingLink.taskId,
      { id: integrationId, projectId, project: { workspaceId } },
      async (database, afterCommit) => {
        const [linked] = await database
          .select({ id: externalLinkTable.id })
          .from(externalLinkTable)
          .where(
            and(
              eq(externalLinkTable.id, existingLink.id),
              eq(externalLinkTable.taskId, existingLink.taskId),
              eq(externalLinkTable.integrationId, integrationId),
            ),
          )
          .for("update");
        if (!linked) return "skipped" as const;

        const updateData: Record<string, unknown> = {
          title: issue.title,
          description: taskDescriptionFromIssue(issue.description),
        };

        if (priority) updateData.priority = priority;
        if (status) updateData.status = status;

        await database
          .update(taskTable)
          .set(updateData)
          .where(linkedTaskScope(existingLink.taskId, projectId));

        await importLabelsForTask(
          labels,
          existingLink.taskId,
          workspaceId,
          database,
        );
        await importNotesForTask(issue, notes, existingLink.taskId, database);

        afterCommit(async () => {
          for (const type of [
            "task.updated",
            "task.labels_updated",
            "comment.updated",
          ])
            await publishEvent(type, {
              projectId,
              taskId: existingLink.taskId,
            });
        });
        return "updated" as const;
      },
    );
    return result ?? "skipped";
  }

  const createdTask = await withIntegrationTask(
    null,
    { id: integrationId, projectId, project: { workspaceId } },
    async (tx) => {
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

      const [created] = await tx
        .insert(taskTable)
        .values(taskValues)
        .returning();

      if (!created) {
        throw new Error("Failed to create task");
      }

      await createExternalLink(
        {
          taskId: created.id,
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
        },
        tx,
      );

      await importLabelsForTask(labels, created.id, workspaceId, tx);
      await importNotesForTask(issue, notes, created.id, tx);

      return created;
    },
  );
  if (!createdTask) return "skipped";

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
  database: IntegrationDatabase = db,
): Promise<void> {
  const names = issueLabels.filter((name) => name && !isSystemLabelName(name));

  // GitLab issue, so its absence there is not a reason to remove labels.
  if (names.length === 0) {
    return;
  }

  const existingLabelsOnTask = await database.query.labelTable.findMany({
    where: and(eq(labelTable.taskId, taskId), inArray(labelTable.name, names)),
  });

  for (const name of names) {
    if (existingLabelsOnTask.some((label) => label.name === name)) {
      continue;
    }

    const existingWorkspaceLabel = await database.query.labelTable.findFirst({
      where: and(
        eq(labelTable.workspaceId, workspaceId),
        eq(labelTable.name, name),
      ),
    });

    await database
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

async function fetchIssueNotes(
  issue: GitlabIssue,
  config: GitlabConfig,
  client: GitlabClient,
): Promise<GitlabNote[]> {
  const allNotes: GitlabNote[] = [];
  for (let page = 1; page <= MAX_PAGES; page++) {
    const notes = await client.listIssueNotes(
      config.projectPath,
      issue.iid,
      page,
      PER_PAGE,
    );

    if (notes.length === 0) break;

    allNotes.push(...notes);
    if (notes.length < PER_PAGE) break;
  }
  return allNotes;
}

async function importNotesForTask(
  issue: GitlabIssue,
  notes: GitlabNote[],
  taskId: string,
  database: IntegrationDatabase,
): Promise<void> {
  for (const note of notes) {
    // Skip system notes (label/state changes) and internal notes.
    if (note.system || note.internal) {
      continue;
    }

    const username = note.author?.username ?? note.author?.name ?? "";

    await database
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

  const task = await resolveMergeRequestTask({
    projectId,
    projectSlug,
    config,
    mergeRequest: { ...mergeRequest, source_branch: branchName },
  });

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
  await publishEvent("task.updated", { projectId, taskId: task.id });
}
