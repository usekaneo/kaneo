import { and, asc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { labelTable, projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { removeLabelFromGitea } from "../../plugins/gitea/utils/sync-label-to-gitea";
import { removeLabelFromGitHub } from "../../plugins/github/utils/sync-label-to-github";
import { removeLabelFromGitlab } from "../../plugins/gitlab/utils/sync-label-to-gitlab";
import { withLabelDeletionLock } from "../deletion-lock";

export const LABEL_DELETE_BATCH_SIZE = 25;
type Label = typeof labelTable.$inferSelect;

async function notifyDeletion(label: Label, userId: string) {
  if (!label.taskId) return;
  const [task] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskTable.id, label.taskId),
        eq(projectTable.workspaceId, label.workspaceId ?? ""),
      ),
    )
    .limit(1);
  // Legacy inconsistent rows may be cleaned up, but never emit foreign events.
  if (!task) return;
  for (const remove of [
    removeLabelFromGitHub,
    removeLabelFromGitea,
    removeLabelFromGitlab,
  ]) {
    try {
      await remove(task.id, label.name);
    } catch {
      console.error(
        "Failed to synchronize a label removal with an external provider",
      );
    }
  }
  await publishEvent(
    "task.label_deleted",
    {
      label,
      task,
      projectId: task.projectId,
      taskId: task.id,
      userId,
      type: "label_deleted",
    },
    { waitForHandlers: true },
  );
}

async function deleteLabel(
  id: string,
  userId: string,
): Promise<Label & { pendingDeletion?: true }> {
  return withLabelDeletionLock(id, async () => {
    const label = await db.query.labelTable.findFirst({
      where: eq(labelTable.id, id),
    });
    if (!label) throw new HTTPException(404, { message: "Label not found" });

    if (label.taskId) {
      const [task] = await db
        .select({ workspaceId: projectTable.workspaceId })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .where(eq(taskTable.id, label.taskId))
        .limit(1);
      if (!task || task.workspaceId !== label.workspaceId)
        throw new HTTPException(404, { message: "Task not found" });
      const [deleted] = await db
        .delete(labelTable)
        .where(eq(labelTable.id, id))
        .returning();
      if (!deleted)
        throw new HTTPException(404, { message: "Label not found" });
      await notifyDeletion(deleted, userId);
      return deleted;
    }

    // Persist the snapshot boundary before the first batch. A disconnect or
    // restart leaves this root available for the same DELETE request to resume.
    const [root] = await db
      .update(labelTable)
      .set({
        deletionStartedAt: sql`coalesce(${labelTable.deletionStartedAt}, clock_timestamp())`,
      })
      .where(eq(labelTable.id, id))
      .returning();
    if (!root) throw new HTTPException(404, { message: "Label not found" });
    if (root.workspaceId) {
      const predicate = and(
        eq(labelTable.workspaceId, root.workspaceId),
        eq(labelTable.name, root.name),
        isNotNull(labelTable.taskId),
        lte(
          labelTable.createdAt,
          sql`(select deletion_started_at from label where id = ${id})`,
        ),
      );
      const rows = await db
        .select({ id: labelTable.id })
        .from(labelTable)
        .where(predicate)
        .orderBy(asc(labelTable.createdAt), asc(labelTable.id))
        .limit(LABEL_DELETE_BATCH_SIZE + 1);
      for (const row of rows.slice(0, LABEL_DELETE_BATCH_SIZE)) {
        // Recheck the snapshot/name if a concurrent edit changed this copy.
        const [deleted] = await db
          .delete(labelTable)
          .where(and(eq(labelTable.id, row.id), predicate))
          .returning();
        if (deleted) await notifyDeletion(deleted, userId);
      }
      if (rows.length > LABEL_DELETE_BATCH_SIZE)
        return { ...root, pendingDeletion: true };
    }
    const [deleted] = await db
      .delete(labelTable)
      .where(eq(labelTable.id, id))
      .returning();
    if (!deleted) throw new HTTPException(404, { message: "Label not found" });
    return deleted;
  });
}

export default deleteLabel;
