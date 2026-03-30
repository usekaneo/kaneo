import { eq, inArray } from "drizzle-orm";
import db from "../../../database";
import { labelTable, taskTable } from "../../../database/schema";
import { findExternalLink } from "../../github/services/link-manager";
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

async function syncGiteaLabelsToTask(
  taskId: string,
  workspaceId: string,
  giteaLabels: Array<{ name: string; color?: string }>,
) {
  const desiredNames = new Set(giteaLabels.map((l) => l.name));
  const existingRows = await db.query.labelTable.findMany({
    where: eq(labelTable.taskId, taskId),
  });

  const labelsToInsert = giteaLabels
    .filter((g) => !existingRows.some((row) => row.name === g.name))
    .map((g) => ({
      name: g.name,
      color: g.color ? `#${g.color.replace(/^#/, "")}` : "#6B7280",
      taskId,
      workspaceId,
    }));

  if (labelsToInsert.length > 0) {
    await db.insert(labelTable).values(labelsToInsert).onConflictDoNothing();
  }

  const labelsToDelete = existingRows
    .filter(
      (row) => !desiredNames.has(row.name) && !isSystemLabelName(row.name),
    )
    .map((row) => row.id);

  if (labelsToDelete.length > 0) {
    await db.delete(labelTable).where(inArray(labelTable.id, labelsToDelete));
  }
}

export async function handleGiteaIssueLabeled(payload: IssueLabeledPayload) {
  const { issue, repository, label: addedLabel } = payload;

  const baseUrl = baseUrlFromRepositoryHtmlUrl(repository.html_url);
  if (!baseUrl) return;

  const owner = repoOwnerLogin(repository);
  const integrations = await findAllIntegrationsByGiteaRepo(
    baseUrl,
    owner,
    repository.name,
  );

  for (const integration of integrations) {
    const existingLink = await findExternalLink(
      integration.id,
      "issue",
      issue.number.toString(),
    );

    if (!existingLink) {
      continue;
    }

    const priority = extractIssuePriority(issue.labels);
    const status = extractIssueStatus(issue.labels);

    if (priority) {
      await db
        .update(taskTable)
        .set({ priority })
        .where(eq(taskTable.id, existingLink.taskId));
    }

    if (status) {
      await updateTaskStatus(existingLink.taskId, status);
    }

    if (payload.action === "label_updated") {
      if (issue.labels === undefined) {
        continue;
      }

      const task = await db.query.taskTable.findFirst({
        where: eq(taskTable.id, existingLink.taskId),
        with: {
          project: true,
        },
      });
      if (task?.project?.workspaceId) {
        await syncGiteaLabelsToTask(
          existingLink.taskId,
          task.project.workspaceId,
          giteaLabelsForSync(issue.labels),
        );
      }
      continue;
    }

    if (!addedLabel) {
      continue;
    }

    if (isSystemLabelName(addedLabel.name)) {
      continue;
    }

    if (payload.action === "labeled") {
      const task = await db.query.taskTable.findFirst({
        where: eq(taskTable.id, existingLink.taskId),
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
          await db.insert(labelTable).values({
            name: addedLabel.name,
            color,
            taskId: task.id,
            workspaceId: task.project.workspaceId,
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
  }
}
