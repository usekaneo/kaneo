import { eq } from "drizzle-orm";
import db from "../../../database";
import { labelTable, taskTable } from "../../../database/schema";
import { findExternalLink } from "../services/link-manager";
import { findAllIntegrationsByRepo } from "../services/task-service";
import {
  extractIssuePriority,
  extractIssueStatus,
} from "../utils/extract-priority";

type IssueLabeledPayload = {
  action: string;
  issue: {
    number: number;
    labels?: Array<string | { name?: string }>;
  };
  label?: {
    name: string;
    color: string;
  };
  repository: {
    owner: { login: string };
    name: string;
  };
};

export async function handleIssueLabeled(payload: IssueLabeledPayload) {
  const { issue, repository, label: addedLabel } = payload;

  const integrations = await findAllIntegrationsByRepo(
    repository.owner.login,
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

    const updateData: Record<string, unknown> = {};

    if (priority) {
      updateData.priority = priority;
    }

    if (status) {
      updateData.status = status;
    }

    if (Object.keys(updateData).length > 0) {
      await db
        .update(taskTable)
        .set(updateData)
        .where(eq(taskTable.id, existingLink.taskId));
    }

    if (!addedLabel) {
      return;
    }

    const isSystemLabel =
      addedLabel.name.startsWith("priority:") ||
      addedLabel.name.startsWith("status:");

    if (isSystemLabel) {
      return;
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
          where: (table, { and, eq }) =>
            and(
              eq(table.workspaceId, task.project.workspaceId),
              eq(table.name, addedLabel.name),
              eq(table.taskId, task.id),
            ),
        });

        if (!existingLabel) {
          const color = addedLabel.color ? `#${addedLabel.color}` : "#6B7280";
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
        where: (table, { and, eq }) =>
          and(
            eq(table.taskId, existingLink.taskId),
            eq(table.name, addedLabel.name),
          ),
      });

      for (const label of labelsToDelete) {
        await db.delete(labelTable).where(eq(labelTable.id, label.id));
      }
    }

    return;
  }
}
