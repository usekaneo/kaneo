import { eq, inArray } from "drizzle-orm";
import db from "../../../database";
import { labelTable } from "../../../database/schema";
import type { GitlabWebhookLabel } from "../webhooks/types";
import { isSystemLabelName } from "./system-labels";

const DEFAULT_LABEL_COLOR = "#6B7280";

function labelColor(label: GitlabWebhookLabel): string {
  return label.color
    ? `#${label.color.replace(/^#/, "")}`
    : DEFAULT_LABEL_COLOR;
}

/**
 * Mirrors a GitLab issue's ordinary labels onto the task. `priority:` and
 * `status:` are Kaneo's own vocabulary and are handled by the task's priority
 * and status fields instead, so they never become label rows.
 *
 * The GitLab payload is the complete set, so labels missing from it are removed.
 */
export async function syncIssueLabelsToTask(
  taskId: string,
  workspaceId: string | undefined,
  labels: GitlabWebhookLabel[] | undefined,
): Promise<void> {
  if (!workspaceId || !labels) {
    return;
  }

  const desired = labels.filter(
    (label) => label.title && !isSystemLabelName(label.title),
  );
  const desiredNames = new Set(desired.map((label) => label.title as string));

  const existingRows = await db.query.labelTable.findMany({
    where: eq(labelTable.taskId, taskId),
  });

  const toInsert = desired
    .filter((label) => !existingRows.some((row) => row.name === label.title))
    .map((label) => ({
      name: label.title as string,
      color: labelColor(label),
      taskId,
      workspaceId,
    }));

  const recolor = new Map<string, string[]>();
  for (const label of desired) {
    const row = existingRows.find((r) => r.name === label.title);
    if (!row) continue;
    const want = labelColor(label);
    const have = row.color
      ? `#${row.color.replace(/^#/, "")}`
      : DEFAULT_LABEL_COLOR;
    if (have === want) continue;
    const ids = recolor.get(want) ?? [];
    ids.push(row.id);
    recolor.set(want, ids);
  }

  for (const [color, ids] of recolor) {
    await db
      .update(labelTable)
      .set({ color })
      .where(inArray(labelTable.id, ids));
  }

  if (toInsert.length > 0) {
    await db
      .insert(labelTable)
      .values(toInsert)
      .onConflictDoNothing({
        target: [labelTable.taskId, labelTable.name],
      });
  }

  const toDelete = existingRows
    .filter(
      (row) => !desiredNames.has(row.name) && !isSystemLabelName(row.name),
    )
    .map((row) => row.id);

  if (toDelete.length > 0) {
    await db.delete(labelTable).where(inArray(labelTable.id, toDelete));
  }
}
