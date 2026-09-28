import { inArray } from "drizzle-orm";
import { externalLinkTable, labelTable } from "../../database/schema";
import type { TaskReadDatabase } from "../bounded-read";
import { parseMetadata } from "./get-tasks";

export type TaskLabelDecoration = { id: string; name: string; color: string };

export type TaskExternalLinkDecoration = {
  id: string;
  taskId: string;
  integrationId: string | null;
  resourceType: string;
  externalId: string;
  url: string;
  title: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Labels and external links for a set of tasks, fetched with one query each and
 * grouped by task id, so list endpoints stay at a fixed number of round-trips
 * regardless of how many tasks they return.
 */
export async function loadTaskDecorations(
  db: TaskReadDatabase,
  taskIds: string[],
) {
  const labelsByTask = new Map<string, TaskLabelDecoration[]>();
  const externalLinksByTask = new Map<string, TaskExternalLinkDecoration[]>();

  if (taskIds.length === 0) {
    return { labelsByTask, externalLinksByTask };
  }

  // Sequential: a transaction runs on one connection.
  const labelsData = await db
    .select({
      id: labelTable.id,
      name: labelTable.name,
      color: labelTable.color,
      taskId: labelTable.taskId,
    })
    .from(labelTable)
    .where(inArray(labelTable.taskId, taskIds));
  const externalLinksData = await db
    .select()
    .from(externalLinkTable)
    .where(inArray(externalLinkTable.taskId, taskIds));

  for (const label of labelsData) {
    if (!label.taskId) continue;
    const labels = labelsByTask.get(label.taskId) ?? [];
    labels.push({ id: label.id, name: label.name, color: label.color });
    labelsByTask.set(label.taskId, labels);
  }

  for (const externalLink of externalLinksData) {
    const links = externalLinksByTask.get(externalLink.taskId) ?? [];
    links.push({
      ...externalLink,
      metadata: parseMetadata(externalLink.metadata),
    });
    externalLinksByTask.set(externalLink.taskId, links);
  }

  return { labelsByTask, externalLinksByTask };
}
