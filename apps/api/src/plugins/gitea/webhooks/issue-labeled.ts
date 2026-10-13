import { resumeLabelChanges } from "../../sync/resume-label-changes";
import { acceptsIssue, readSyncRules } from "../../sync/rules";
import { handleGiteaIssueOpened } from "./issue-opened";
import { withIntegrationLink } from "../../github/services/with-integration-link";
import {
  type IntegrationDatabase,
  linkedTaskScope,
} from "../../github/services/integration-task-scope";
import { eq, inArray } from "drizzle-orm";
import { labelTable, taskTable } from "../../../database/schema";
import { publishEvent } from "../../../events";
import {
  findExternalLink,
  updateExternalLink,
} from "../../github/services/link-manager";
import { updateTaskStatus } from "../../github/services/task-service";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../../github/utils/extract-priority";
import {
  findAllIntegrationsByGiteaRepo,
  repoOwnerLogin,
} from "../services/integration-lookup";
import { isSystemLabelName } from "../utils/system-labels";
import { baseUrlFromRepositoryHtmlUrl } from "../utils/webhook-repo";

type IssueLabeledPayload = {
  action: string;
  issue: {
    number: number;
    labels?: Array<string | { name?: string; color?: string }>;
  };
  label?: {
    name: string;
    color: string;
  };
  repository: {
    owner: { login?: string; username?: string };
    name: string;
    html_url: string;
  };
};

/** Non-system labels from a Gitea issue (used when action is label_updated). */
function giteaLabelsForSync(
  labels: IssueLabeledPayload["issue"]["labels"],
): Array<{ name: string; color?: string }> {
  if (!labels) return [];
  const out: Array<{ name: string; color?: string }> = [];
  for (const raw of labels) {
    const name = typeof raw === "string" ? raw : raw.name;
    if (!name || isSystemLabelName(name)) continue;
    const color =
      typeof raw === "object" && raw && "color" in raw ? raw.color : undefined;
    out.push({ name, color });
  }
  return out;
}

function normalizedGiteaLabelColor(g: { color?: string }): string {
  return g.color ? `#${g.color.replace(/^#/, "")}` : "#6B7280";
}

async function syncGiteaLabelsToTask(
  taskId: string,
  workspaceId: string,
  giteaLabels: Array<{ name: string; color?: string }>,
  db: IntegrationDatabase,
  previousNames?: string[],
) {
  const desiredNames = new Set(giteaLabels.map((l) => l.name));
  const previous = previousNames ? new Set(previousNames) : undefined;
  const existingRows = await db.query.labelTable.findMany({
    where: eq(labelTable.taskId, taskId),
  });

  const labelsToInsert = giteaLabels
    .filter(
      (g) =>
        (!previous || !previous.has(g.name)) &&
        !existingRows.some((row) => row.name === g.name),
    )
    .map((g) => ({
      name: g.name,
      color: normalizedGiteaLabelColor(g),
      taskId,
      workspaceId,
    }));

  const colorToIds = new Map<string, string[]>();
  for (const g of giteaLabels) {
    if (isSystemLabelName(g.name)) continue;
    const row = existingRows.find((r) => r.name === g.name);
    if (!row) continue;
    const want = normalizedGiteaLabelColor(g);
    const have = row.color ? `#${row.color.replace(/^#/, "")}` : "#6B7280";
    if (have === want) continue;
    const list = colorToIds.get(want) ?? [];
    list.push(row.id);
    colorToIds.set(want, list);
  }

  for (const [color, ids] of colorToIds) {
    if (ids.length === 0) continue;
    await db
      .update(labelTable)
      .set({ color })
      .where(inArray(labelTable.id, ids));
  }

  if (labelsToInsert.length > 0) {
    await db
      .insert(labelTable)
      .values(labelsToInsert)
      .onConflictDoNothing({
        target: [labelTable.taskId, labelTable.name],
      });
  }

  const labelsToDelete = existingRows
    .filter(
      (row) =>
        (!previous || previous.has(row.name)) &&
        !desiredNames.has(row.name) &&
        !isSystemLabelName(row.name),
    )
    .map((row) => row.id);

  if (labelsToDelete.length > 0) {
    await db.delete(labelTable).where(inArray(labelTable.id, labelsToDelete));
  }
}

export async function handleGiteaIssueLabeled(
  payload: IssueLabeledPayload,
  integrationId?: string,
) {
  const { issue, repository, label: addedLabel } = payload;

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) return;

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
    repository.name,
    integrationId,
  );

  for (const integration of integrations) {
    try {
      const existingLink = await findExternalLink(
        integration.id,
        "issue",
        issue.number.toString(),
      );

      if (!existingLink) {
        const fullIssue = issue as typeof issue &
          Partial<Parameters<typeof handleGiteaIssueOpened>[0]["issue"]>;
        if (
          ["label_updated", "labeled"].includes(payload.action) &&
          readSyncRules(integration.config)?.incoming.mode === "labels" &&
          acceptsIssue(integration.config, issue.labels) &&
          fullIssue.title &&
          fullIssue.html_url
        ) {
          await handleGiteaIssueOpened(
            payload as Parameters<typeof handleGiteaIssueOpened>[0],
            integration.id,
          );
        }
        continue;
      }

      await withIntegrationLink(
        existingLink,
        integration,
        async (db, afterCommit, existingLink) => {
          const names = (issue.labels ?? []).flatMap((label) => {
            const name = typeof label === "string" ? label : label.name;
            return name ? [name] : [];
          });
          const changes = resumeLabelChanges(existingLink, names);
          if (changes.baseline && issue.labels !== undefined)
            await updateExternalLink(
              existingLink.id,
              { metadata: { syncResumeLabelBaseline: names } },
              db,
            );
          const priority = extractIssuePriority(issue.labels);
          const status = extractIssueStatus(issue.labels);

          if (priority && changes.priorityChanged) {
            await db
              .update(taskTable)
              .set({ priority })
              .where(
                linkedTaskScope(existingLink.taskId, integration.projectId),
              );
          }

          if (status && changes.statusChanged) {
            const statusResult = await updateTaskStatus(
              existingLink.taskId,
              status,
              db,
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

          if (payload.action === "label_updated") {
            if (issue.labels === undefined) {
              return;
            }

            const task = await db.query.taskTable.findFirst({
              where: linkedTaskScope(
                existingLink.taskId,
                integration.projectId,
              ),
              with: {
                project: true,
              },
            });
            if (task?.project?.workspaceId) {
              await syncGiteaLabelsToTask(
                existingLink.taskId,
                task.project.workspaceId,
                giteaLabelsForSync(issue.labels),
                db,
                changes.baseline,
              );
              afterCommit(() =>
                publishEvent("task.labels_updated", {
                  projectId: integration.projectId,
                  taskId: existingLink.taskId,
                }),
              );
            }
            return;
          }

          if (!addedLabel) {
            if (priority)
              afterCommit(() =>
                publishEvent("task.updated", {
                  projectId: integration.projectId,
                  taskId: existingLink.taskId,
                }),
              );
            return;
          }

          if (isSystemLabelName(addedLabel.name)) {
            if (priority)
              afterCommit(() =>
                publishEvent("task.updated", {
                  projectId: integration.projectId,
                  taskId: existingLink.taskId,
                }),
              );
            return;
          }

          if (payload.action === "labeled") {
            const task = await db.query.taskTable.findFirst({
              where: linkedTaskScope(
                existingLink.taskId,
                integration.projectId,
              ),
              with: {
                project: true,
              },
            });

            if (task?.project?.workspaceId) {
              const existingLabel = await db.query.labelTable.findFirst({
                where: (table, { and, eq: e }) =>
                  and(
                    e(table.workspaceId, task.project.workspaceId),
                    e(table.name, addedLabel.name),
                    e(table.taskId, task.id),
                  ),
              });

              if (!existingLabel) {
                const color = addedLabel.color
                  ? `#${addedLabel.color.replace(/^#/, "")}`
                  : "#6B7280";
                await db
                  .insert(labelTable)
                  .values({
                    name: addedLabel.name,
                    color,
                    taskId: task.id,
                    workspaceId: task.project.workspaceId,
                  })
                  .onConflictDoNothing({
                    target: [labelTable.taskId, labelTable.name],
                  });
              }
            }
          }

          if (payload.action === "unlabeled") {
            const labelsToDelete = await db.query.labelTable.findMany({
              where: (table, { and, eq: e }) =>
                and(
                  e(table.taskId, existingLink.taskId),
                  e(table.name, addedLabel.name),
                ),
            });

            for (const label of labelsToDelete) {
              await db.delete(labelTable).where(eq(labelTable.id, label.id));
            }
          }
          afterCommit(() =>
            publishEvent("task.labels_updated", {
              projectId: integration.projectId,
              taskId: existingLink.taskId,
            }),
          );
        },
      );
    } catch (error) {
      console.error("Gitea issue_labeled handler failed for integration", {
        integrationId: integration.id,
        issueNumber: issue.number,
        repository: `${owner}/${repository.name}`,
        error,
      });
    }
  }
}
