import { acceptsIssue } from "../../plugins/sync/rules";
import { canSyncTask } from "../../plugins/sync/eligibility";
import { sameConfig } from "../../plugins/sync/same-config";
import { and, eq, inArray, notInArray } from "drizzle-orm";
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
import type { GiteaConfig } from "../../plugins/gitea/config";
import { isKaneoComment } from "../../plugins/gitea/utils/comment-origin";
import {
  createGiteaClient,
  type GiteaIssue,
  type GiteaComment,
  type GiteaLabel,
  type GiteaPullRequest,
} from "../../plugins/gitea/utils/gitea-api";
import {
  createExternalLink,
  findExternalLink,
} from "../../plugins/github/services/link-manager";
import { resolvePullRequestTask } from "../../plugins/github/services/resolve-pull-request-task";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../plugins/github/utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../../plugins/github/utils/format";
import { claimTaskNumber } from "../../task/controllers/claim-task-numbers";

import {
  type IntegrationDatabase,
  linkedTaskScope,
  withIntegrationTask,
} from "../../plugins/github/services/integration-task-scope";

type ImportResult = {
  imported: number;
  updated: number;
  skipped: number;
  errors?: string[];
};

type LabelLike = { name?: string };

function toPriorityLabels(labels: GiteaLabel[]): LabelLike[] {
  return labels.map((label) => ({ name: label.name }));
}

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

  let config: GiteaConfig;
  try {
    config = JSON.parse(integration.config) as GiteaConfig;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn("Invalid Gitea integration config JSON", {
      integrationId: integration.id,
      error,
    });
    throw new HTTPException(400, {
      message: `Invalid Gitea integration config: ${message}`,
    });
  }

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

  const allPRs: GiteaPullRequest[] = [];
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

  if (!existingLink && !acceptsIssue(config, issue.labels)) return "skipped";

  const labels = issue.labels ?? [];
  const adaptedLabels = toPriorityLabels(labels);
  const priority = extractIssuePriority(adaptedLabels);
  const status = extractIssueStatus(adaptedLabels);

  const comments = await fetchIssueComments(issue.number, config, client);

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
        if (
          !linked ||
          !(await canSyncTask(existingLink.taskId, integrationId, database))
        )
          return "skipped" as const;

        const updateData: Record<string, unknown> = {
          title: issue.title,
          description: formatTaskDescriptionFromIssue(issue.body),
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
        await canSyncTask(existingLink.taskId, integrationId, database);

        await importCommentsForTask(comments, existingLink.taskId, database);

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
      const binding = await tx.query.integrationTable.findFirst({
        where: eq(integrationTable.id, integrationId),
      });
      if (
        !binding ||
        !sameConfig(binding.config, JSON.stringify(config)) ||
        !acceptsIssue(binding.config, issue.labels) ||
        (await findExternalLink(
          integrationId,
          "issue",
          String(issue.number),
          tx,
        ))
      )
        return null;
      const nextNumber = await claimTaskNumber(projectId, tx);

      const taskValues: typeof taskTable.$inferInsert = {
        projectId,
        userId: null,
        title: issue.title,
        description: formatTaskDescriptionFromIssue(issue.body),
        status: status || "to-do",
        priority: priority ?? "low",
        number: nextNumber,
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
          externalId: issue.number.toString(),
          url: issue.html_url,
          title: issue.title,
          metadata: {
            state: issue.state,
            createdFrom: "gitea-import",
            author: issue.user?.login ?? issue.user?.username,
          },
        },
        tx,
      );

      await importLabelsForTask(labels, created.id, workspaceId, tx);
      await canSyncTask(created.id, integrationId, tx, binding.config);

      await importCommentsForTask(comments, created.id, tx);

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
    source: "gitea-import",
    integrationId,
    externalId: issue.number.toString(),
  });

  return "imported";
}

async function importLabelsForTask(
  issueLabels: GiteaIssue["labels"],
  taskId: string,
  workspaceId: string,
  database: IntegrationDatabase = db,
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

  const expectedNames = nonSystemLabels.map((label) => label.name);

  if (expectedNames.length > 0) {
    await database
      .delete(labelTable)
      .where(
        and(
          eq(labelTable.taskId, taskId),
          notInArray(labelTable.name, expectedNames),
        ),
      );
  } else {
    await database.delete(labelTable).where(eq(labelTable.taskId, taskId));
  }

  const existingLabelsOnTask = await database.query.labelTable.findMany({
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

    const existingWorkspaceLabel = await database.query.labelTable.findFirst({
      where: and(
        eq(labelTable.workspaceId, workspaceId),
        eq(labelTable.name, labelData.name),
      ),
    });

    const colorToUse = existingWorkspaceLabel?.color || labelData.color;

    await database
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

async function fetchIssueComments(
  issueNumber: number,
  config: GiteaConfig,
  client: ReturnType<typeof createGiteaClient>,
): Promise<GiteaComment[]> {
  const allComments: GiteaComment[] = [];
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

  return allComments;
}

async function importCommentsForTask(
  allComments: GiteaComment[],
  taskId: string,
  database: IntegrationDatabase,
): Promise<void> {
  for (const comment of allComments) {
    const username = comment.user?.login ?? comment.user?.username ?? "";
    if (username.endsWith("[bot]") || isKaneoComment(comment.body)) {
      continue;
    }

    await database
      .insert(activityTable)
      .values({
        taskId,
        type: "comment",
        content: comment.body,
        externalUserName: username || "Unknown",
        externalUserAvatar: comment.user?.avatar_url ?? null,
        externalSource: "gitea",
        externalUrl: comment.html_url,
        eventData: {
          externalCommentId: comment.id,
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
  const existingLink = await findExternalLink(
    integrationId,
    "pull_request",
    pr.number.toString(),
  );
  if (existingLink) return;

  const task = await resolvePullRequestTask({
    integrationId,
    projectId,
    projectSlug,
    config,
    repositoryUrl: `${config.baseUrl.replace(/\/$/, "")}/${config.repositoryOwner}/${config.repositoryName}`,
    pullRequest: pr,
  });
  if (!task) return;

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
  await publishEvent("task.updated", { projectId, taskId: task.id });
}
