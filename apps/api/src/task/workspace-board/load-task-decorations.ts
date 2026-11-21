import { asc, inArray } from "drizzle-orm";
import { externalLinkTable, labelTable } from "../../database/schema";
import type { TaskReadDatabase } from "../bounded-read";
import { getSubtaskCounts } from "../get-subtask-counts";
import { parseLinkMetadata } from "../parse-link-metadata";

function groupByTask<Row extends { taskId: string | null }, Item>(
  rows: Row[],
  toItem: (row: Row) => Item,
) {
  const byTask = new Map<string, Item[]>();
  for (const row of rows) {
    if (!row.taskId) continue;
    const items = byTask.get(row.taskId) ?? [];
    items.push(toItem(row));
    byTask.set(row.taskId, items);
  }
  return byTask;
}

/** Subtask counts, labels and external links for one page of board tasks. */
export async function loadTaskDecorations(
  db: TaskReadDatabase,
  taskIds: string[],
  workspaceId: string,
  userId: string,
) {
  const subtaskCounts = await getSubtaskCounts(
    db,
    taskIds,
    workspaceId,
    false,
    userId,
  );
  const labels = taskIds.length
    ? await db
        .select({
          id: labelTable.id,
          name: labelTable.name,
          color: labelTable.color,
          taskId: labelTable.taskId,
        })
        .from(labelTable)
        .where(inArray(labelTable.taskId, taskIds))
        .orderBy(asc(labelTable.name), asc(labelTable.id))
    : [];
  const externalLinks = taskIds.length
    ? await db
        .select()
        .from(externalLinkTable)
        .where(inArray(externalLinkTable.taskId, taskIds))
        .orderBy(asc(externalLinkTable.id))
    : [];

  const labelsByTask = groupByTask(
    labels,
    ({ taskId: _taskId, ...label }) => label,
  );
  const linksByTask = groupByTask(externalLinks, (link) => ({
    ...link,
    metadata: parseLinkMetadata(link.metadata),
  }));

  return (taskId: string) => ({
    subtaskCounts: subtaskCounts.get(taskId) ?? { completed: 0, total: 0 },
    labels: labelsByTask.get(taskId) ?? [],
    externalLinks: linksByTask.get(taskId) ?? [],
  });
}
