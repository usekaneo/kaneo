import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, isNull } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  columnTable,
  externalLinkTable,
  githubImportTable,
  integrationTable,
  labelTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import {
  type GitHubConfig,
  hasVerifiedGitHubBinding,
} from "../../plugins/github/config";
import { resolvePullRequestTask } from "../../plugins/github/services/resolve-pull-request-task";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../plugins/github/utils/extract-priority";
import { formatTaskDescriptionFromIssue } from "../../plugins/github/utils/format";
import { getVerifiedInstallationOctokit } from "../../plugins/github/utils/github-app";
import { claimTaskNumber } from "../../task/controllers/claim-task-numbers";
import { VIRTUAL_STATUSES } from "../../task/validate-task-fields";
import { withGithubImportLock } from "../import-lock";
import {
  commentsPageSchema,
  fetchImportPage,
  IMPORT_PAGES_PER_REQUEST,
  type ImportedComment,
  type ImportedIssue,
  type ImportedLabel,
  type ImportedPull,
  issuesPageSchema,
  labelsPageSchema,
  nextCursor,
  pullsPageSchema,
} from "../import-pages";
import {
  type GitHubImportState,
  importProgress,
  initialImportState,
} from "../import-state";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
async function resolveImportedStatus(
  tx: Transaction,
  projectId: string,
  requested: string | null,
  current?: string,
) {
  for (const status of [requested, current, "to-do"]) {
    if (!status) continue;
    const column = await tx.query.columnTable.findFirst({
      where: and(
        eq(columnTable.projectId, projectId),
        eq(columnTable.slug, status),
      ),
      columns: { id: true },
    });
    if (column) return { status, columnId: column.id };
    if ((VIRTUAL_STATUSES as readonly string[]).includes(status))
      return { status, columnId: null };
  }
  const first = await tx.query.columnTable.findFirst({
    where: eq(columnTable.projectId, projectId),
    orderBy: asc(columnTable.position),
    columns: { id: true, slug: true },
  });
  return { status: first?.slug ?? "planned", columnId: first?.id ?? null };
}
function readConfig(integration: typeof integrationTable.$inferSelect) {
  if (!integration.isActive)
    throw new HTTPException(400, {
      message: "GitHub integration is not active",
    });
  let config: GitHubConfig;
  try {
    config = JSON.parse(integration.config);
  } catch {
    throw new HTTPException(400, {
      message: "Invalid GitHub integration configuration",
    });
  }
  if (!hasVerifiedGitHubBinding(config) || !config.installationId)
    throw new HTTPException(400, {
      message:
        "GitHub integration must be reconnected by a repository administrator",
    });
  return config;
}
function conflict() {
  return new HTTPException(409, {
    message: "GitHub integration or import changed; refresh before resuming",
  });
}

export async function importIssues(projectId: string, runId?: string) {
  return withGithubImportLock(projectId, async () => {
    const project = await db.query.projectTable.findFirst({
      where: eq(projectTable.id, projectId),
    });
    if (!project)
      throw new HTTPException(404, { message: "Project not found" });
    const integration = await db.query.integrationTable.findFirst({
      where: and(
        eq(integrationTable.projectId, projectId),
        eq(integrationTable.type, "github"),
      ),
    });
    if (!integration)
      throw new HTTPException(404, { message: "GitHub integration not found" });
    const config = readConfig(integration);
    const repositoryId = config.repositoryId;
    if (!repositoryId) throw conflict();
    let run = await db.query.githubImportTable.findFirst({
      where: eq(githubImportTable.integrationId, integration.id),
    });
    if (
      runId &&
      (!run || run.runId !== runId || run.state.repositoryId !== repositoryId)
    )
      throw conflict();
    if (runId && run?.state.phase === "complete")
      return importProgress(run.runId, run.state);
    if (
      !run ||
      run.state.phase === "complete" ||
      run.state.repositoryId !== repositoryId
    ) {
      const [created] = await db
        .insert(githubImportTable)
        .values({
          integrationId: integration.id,
          state: initialImportState(repositoryId),
        })
        .onConflictDoUpdate({
          target: githubImportTable.integrationId,
          set: {
            runId: createId(),
            state: initialImportState(repositoryId),
            updatedAt: new Date(),
          },
        })
        .returning();
      run = created;
    }
    if (!run) throw new Error("Failed to start import");
    let octokit: Awaited<ReturnType<typeof getVerifiedInstallationOctokit>>;
    try {
      octokit = await getVerifiedInstallationOctokit(config, true);
    } catch {
      throw new HTTPException(502, {
        message:
          "GitHub repository could not be verified; check the integration and resume",
      });
    }
    for (
      let page = 0;
      page < IMPORT_PAGES_PER_REQUEST && run.state.phase !== "complete";
      page++
    ) {
      let payload: unknown;
      try {
        payload = await fetchImportPage(octokit, config, run.state);
      } catch {
        throw new HTTPException(502, {
          message: "GitHub import paused; retry to resume saved progress",
        });
      }
      const currentRun: typeof githubImportTable.$inferSelect = run;
      run = await db.transaction(async (tx) => {
        // Serialize against integration changes and webhook issue creation. No
        // provider request is made while this transaction holds row locks.
        const [currentIntegration] = await tx
          .select()
          .from(integrationTable)
          .where(eq(integrationTable.id, integration.id))
          .for("update");
        if (
          !currentIntegration ||
          currentIntegration.config !== integration.config ||
          !currentIntegration.isActive
        )
          throw conflict();
        const state = structuredClone(currentRun.state);
        await applyPage(tx, payload, state, integration.id, project, config);
        const [saved] = await tx
          .update(githubImportTable)
          .set({ state })
          .where(
            and(
              eq(githubImportTable.integrationId, integration.id),
              eq(githubImportTable.runId, currentRun.runId),
            ),
          )
          .returning();
        if (!saved) throw conflict();
        return saved;
      });
    }
    return importProgress(run.runId, run.state);
  });
}

function finishIssue(state: GitHubImportState) {
  state.currentIssue = null;
  state.phase = state.moreIssues ? "issues" : "pulls";
}
function nextIssuePart(state: GitHubImportState) {
  const current = state.currentIssue;
  if (current && current.labelsRemaining > 0) state.phase = "labels";
  else if (current?.moreComments && current.commentsRemaining > 0)
    state.phase = "comments";
  else finishIssue(state);
}
function repositoryMatches(actual: number, state: GitHubImportState) {
  if (actual !== state.repositoryId) throw conflict();
}
function pageError() {
  return new HTTPException(502, {
    message:
      "GitHub returned an invalid import page; saved progress can be resumed",
  });
}
function cursor(
  info: { hasNextPage: boolean; endCursor: string | null },
  previous: string | null,
) {
  try {
    return nextCursor(info, previous);
  } catch {
    throw pageError();
  }
}
async function applyPage(
  tx: Transaction,
  payload: unknown,
  state: GitHubImportState,
  integrationId: string,
  project: typeof projectTable.$inferSelect,
  config: GitHubConfig,
) {
  if (state.phase === "issues") {
    const parsed = issuesPageSchema.safeParse(payload);
    if (!parsed.success) throw pageError();
    repositoryMatches(parsed.data.repository.databaseId, state);
    const page = parsed.data.repository.issues;
    state.issueCursor = cursor(page.pageInfo, state.issueCursor);
    state.moreIssues = page.pageInfo.hasNextPage;
    const issue = page.nodes[0];
    if (!issue || Date.parse(issue.createdAt) > Date.parse(state.startedAt)) {
      state.moreIssues = false;
      finishIssue(state);
      return;
    }
    const task = await importIssue(tx, issue, integrationId, project.id);
    if (!task) {
      state.skipped++;
      finishIssue(state);
      return;
    }
    state[task.result]++;
    const labelsRemaining = pageRemaining(issue.labels);
    const commentsRemaining = pageRemaining(issue.comments);
    state.currentIssue = {
      number: issue.number,
      taskId: task.id,
      labelCursor: cursor(issue.labels.pageInfo, null),
      commentCursor: cursor(issue.comments.pageInfo, null),
      labelsRemaining,
      commentsRemaining,
      moreComments: issue.comments.pageInfo.hasNextPage,
      statusSeen: issue.labels.nodes.some((label) =>
        label.name.startsWith("status:"),
      ),
      prioritySeen: issue.labels.nodes.some((label) =>
        label.name.startsWith("priority:"),
      ),
    };
    await importLabels(tx, issue.labels.nodes, task.id, project.workspaceId);
    await importComments(tx, issue.comments.nodes, task.id, state.startedAt);
    nextIssuePart(state);
    return;
  }
  if (state.phase === "pulls") {
    const parsed = pullsPageSchema.safeParse(payload);
    if (!parsed.success) throw pageError();
    repositoryMatches(parsed.data.repository.databaseId, state);
    const page = parsed.data.repository.pullRequests;
    state.pullCursor = cursor(page.pageInfo, state.pullCursor);
    for (const pull of page.nodes) {
      if (Date.parse(pull.createdAt) > Date.parse(state.startedAt)) {
        state.phase = "complete";
        return;
      }
      await linkPull(tx, pull, integrationId, project, config);
    }
    if (!page.pageInfo.hasNextPage || page.nodes.length === 0)
      state.phase = "complete";
    return;
  }
  const current = state.currentIssue;
  if (!current) throw new Error("Import continuation missing");
  const task = await tx.query.taskTable.findFirst({
    where: and(
      eq(taskTable.id, current.taskId),
      eq(taskTable.projectId, project.id),
    ),
  });
  if (!task) {
    state.skipped++;
    finishIssue(state);
    return;
  }
  if (state.phase === "labels") {
    const parsed = labelsPageSchema.safeParse(payload);
    if (!parsed.success) throw pageError();
    repositoryMatches(parsed.data.repository.databaseId, state);
    const page = parsed.data.repository.issue?.labels;
    if (!page) {
      state.skipped++;
      finishIssue(state);
      return;
    }
    const labels = page.nodes.slice(0, current.labelsRemaining);
    current.labelCursor = cursor(page.pageInfo, current.labelCursor);
    current.labelsRemaining =
      page.pageInfo.hasNextPage && labels.length
        ? Math.max(0, current.labelsRemaining - labels.length)
        : 0;
    const priority = current.prioritySeen ? null : extractIssuePriority(labels);
    const status = current.statusSeen ? null : extractIssueStatus(labels);
    if (priority || status)
      await tx
        .update(taskTable)
        .set({
          ...(priority ? { priority } : {}),
          ...(status
            ? await resolveImportedStatus(tx, project.id, status, task.status)
            : {}),
        })
        .where(
          and(eq(taskTable.id, task.id), eq(taskTable.projectId, project.id)),
        );
    current.prioritySeen ||= labels.some((label) =>
      label.name.startsWith("priority:"),
    );
    current.statusSeen ||= labels.some((label) =>
      label.name.startsWith("status:"),
    );
    await importLabels(tx, labels, task.id, project.workspaceId);
    nextIssuePart(state);
  } else if (state.phase === "comments") {
    const parsed = commentsPageSchema.safeParse(payload);
    if (!parsed.success) throw pageError();
    repositoryMatches(parsed.data.repository.databaseId, state);
    const page = parsed.data.repository.issue?.comments;
    if (!page) {
      state.skipped++;
      finishIssue(state);
      return;
    }
    const comments = page.nodes.slice(0, current.commentsRemaining);
    current.commentCursor = cursor(page.pageInfo, current.commentCursor);
    current.commentsRemaining = Math.max(
      0,
      current.commentsRemaining - comments.length,
    );
    current.moreComments = page.pageInfo.hasNextPage && comments.length > 0;
    await importComments(tx, comments, task.id, state.startedAt);
    nextIssuePart(state);
  }
}
function pageRemaining(page: {
  totalCount: number;
  nodes: unknown[];
  pageInfo: { hasNextPage: boolean };
}) {
  return page.pageInfo.hasNextPage
    ? Math.max(0, page.totalCount - page.nodes.length)
    : 0;
}
async function findLink(
  tx: Transaction,
  integrationId: string,
  resourceType: string,
  externalId: number,
) {
  return tx.query.externalLinkTable.findFirst({
    where: and(
      eq(externalLinkTable.integrationId, integrationId),
      eq(externalLinkTable.resourceType, resourceType),
      eq(externalLinkTable.externalId, String(externalId)),
    ),
  });
}
async function importIssue(
  tx: Transaction,
  issue: ImportedIssue,
  integrationId: string,
  projectId: string,
): Promise<{ id: string; result: "imported" | "updated" } | null> {
  const link = await findLink(tx, integrationId, "issue", issue.number);
  const priority = extractIssuePriority(issue.labels.nodes);
  const status = extractIssueStatus(issue.labels.nodes);
  if (link) {
    const task = await tx.query.taskTable.findFirst({
      where: and(
        eq(taskTable.id, link.taskId),
        eq(taskTable.projectId, projectId),
      ),
    });
    if (!task) return null;
    const [updated] = await tx
      .update(taskTable)
      .set({
        title: issue.title,
        description: formatTaskDescriptionFromIssue(issue.body, task.id),
        ...(await resolveImportedStatus(tx, projectId, status, task.status)),
        ...(priority ? { priority } : {}),
      })
      .where(and(eq(taskTable.id, task.id), eq(taskTable.projectId, projectId)))
      .returning({ id: taskTable.id });
    return updated ? { id: updated.id, result: "updated" } : null;
  }
  const number = await claimTaskNumber(projectId, tx);
  const [created] = await tx
    .insert(taskTable)
    .values({
      projectId,
      userId: null,
      title: issue.title,
      description: formatTaskDescriptionFromIssue(issue.body),
      ...(await resolveImportedStatus(tx, projectId, status)),
      priority: priority ?? "low",
      number,
    })
    .returning({ id: taskTable.id });
  if (!created) throw new Error("Failed to create imported task");
  await tx.insert(externalLinkTable).values({
    taskId: created.id,
    integrationId,
    resourceType: "issue",
    externalId: String(issue.number),
    url: issue.url,
    title: issue.title,
    metadata: JSON.stringify({
      state: issue.state.toLowerCase(),
      createdFrom: "github-import",
      author: issue.author?.login,
    }),
  });
  return { id: created.id, result: "imported" };
}
async function importLabels(
  tx: Transaction,
  labels: ImportedLabel[],
  taskId: string,
  workspaceId: string,
) {
  for (const label of labels) {
    if (label.name.startsWith("priority:") || label.name.startsWith("status:"))
      continue;
    const root = await tx.query.labelTable.findFirst({
      where: and(
        eq(labelTable.workspaceId, workspaceId),
        eq(labelTable.name, label.name),
        isNull(labelTable.taskId),
      ),
    });
    await tx
      .insert(labelTable)
      .values({
        name: label.name,
        color: root?.color || `#${label.color}`,
        taskId,
        workspaceId,
      })
      .onConflictDoNothing({ target: [labelTable.taskId, labelTable.name] });
  }
}
async function importComments(
  tx: Transaction,
  comments: ImportedComment[],
  taskId: string,
  startedAt: string,
) {
  const values = comments
    .filter(
      (comment) =>
        comment.author?.__typename !== "Bot" &&
        !comment.author?.login.endsWith("[bot]") &&
        Date.parse(comment.createdAt) <= Date.parse(startedAt),
    )
    .map((comment) => ({
      taskId,
      type: "comment",
      content: comment.body,
      externalUserName: comment.author?.login ?? "Unknown",
      externalUserAvatar: comment.author?.avatarUrl ?? null,
      externalSource: "github",
      externalUrl: comment.url,
    }));
  if (values.length)
    await tx
      .insert(activityTable)
      .values(values)
      .onConflictDoNothing({
        target: [
          activityTable.taskId,
          activityTable.externalSource,
          activityTable.externalUrl,
        ],
      });
}
async function linkPull(
  tx: Transaction,
  pull: ImportedPull,
  integrationId: string,
  project: typeof projectTable.$inferSelect,
  config: GitHubConfig,
) {
  if (await findLink(tx, integrationId, "pull_request", pull.number)) return;
  const task = await resolvePullRequestTask({
    integrationId,
    projectId: project.id,
    projectSlug: project.slug,
    config,
    repositoryUrl: `https://github.com/${config.repositoryOwner}/${config.repositoryName}`,
    pullRequest: {
      number: pull.number,
      title: pull.title,
      body: pull.body,
      head: { ref: pull.headRefName },
    },
    database: tx,
  });
  if (!task) return;
  await tx.insert(externalLinkTable).values({
    taskId: task.id,
    integrationId,
    resourceType: "pull_request",
    externalId: String(pull.number),
    url: pull.url,
    title: pull.title,
    metadata: JSON.stringify({
      state: pull.state.toLowerCase(),
      branch: pull.headRefName,
      author: pull.author?.login,
    }),
  });
}
