import { and, asc, eq, isNotNull, lte, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  labelDeletionTable,
  labelTable,
  projectTable,
  taskTable,
} from "../../database/schema";
import { notifySyncWorkspaceLabelChanged } from "../../plugins/sync/workspace-label-changed";
import { completeLabelDeletion } from "../complete-label-deletion";
import { withLabelDeletionLock } from "../deletion-lock";

export const LABEL_DELETE_BATCH_SIZE = 25;
type Label = typeof labelTable.$inferSelect;

async function deleteLabel(
  id: string,
  userId: string,
): Promise<Label & { pendingDeletion?: true }> {
  return withLabelDeletionLock(id, async (lease) => {
    const label = await db.query.labelTable.findFirst({
      where: eq(labelTable.id, id),
    });
    if (!label) {
      const pending = await db.query.labelDeletionTable.findFirst({
        where: and(
          eq(labelDeletionTable.id, id),
          eq(labelDeletionTable.deletionId, id),
        ),
      });
      if (!pending)
        throw new HTTPException(404, { message: "Label not found" });
      return completeLabelDeletion(pending, lease);
    }

    if (label.taskId) {
      const [task] = await db
        .select({ workspaceId: projectTable.workspaceId })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .where(eq(taskTable.id, label.taskId))
        .limit(1);
      if (!task || task.workspaceId !== label.workspaceId)
        throw new HTTPException(404, { message: "Task not found" });
      const pending = await lease.transaction(async (tx) => {
        // Match the assignment trigger's lock before removing the row. The
        // outbox then reserves its task/name until all effects finish.
        await tx
          .select({ id: taskTable.id })
          .from(taskTable)
          .where(eq(taskTable.id, label.taskId!))
          .for("no key update");
        const [deleted] = await tx
          .delete(labelTable)
          .where(eq(labelTable.id, id))
          .returning();
        if (!deleted)
          throw new HTTPException(404, { message: "Label not found" });
        const [saved] = await tx
          .insert(labelDeletionTable)
          .values({ ...deleted, deletionId: id, userId })
          .returning();
        return saved!;
      });
      return completeLabelDeletion(pending, lease);
    }

    // Persist the snapshot boundary before the first batch. A disconnect or
    // restart leaves this root available for the same DELETE request to resume.
    const [root] = await lease.transaction((tx) =>
      tx
        .update(labelTable)
        .set({
          // UTC like every timezone-less column, whatever the session time zone.
          deletionStartedAt: sql`coalesce(${labelTable.deletionStartedAt}, timezone('UTC', clock_timestamp()))`,
        })
        .where(eq(labelTable.id, id))
        .returning(),
    );
    if (!root) throw new HTTPException(404, { message: "Label not found" });
    if (root.workspaceId) {
      await lease.check();
      await notifySyncWorkspaceLabelChanged(root.workspaceId, root.id);
      const pending = await db.query.labelDeletionTable.findMany({
        where: eq(labelDeletionTable.deletionId, id),
        orderBy: [
          asc(labelDeletionTable.createdAt),
          asc(labelDeletionTable.id),
        ],
        limit: LABEL_DELETE_BATCH_SIZE + 1,
      });
      for (const saved of pending.slice(0, LABEL_DELETE_BATCH_SIZE)) {
        await completeLabelDeletion(saved, lease);
      }
      if (pending.length > LABEL_DELETE_BATCH_SIZE)
        return { ...root, pendingDeletion: true };
      const remaining = LABEL_DELETE_BATCH_SIZE - pending.length;
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
        .select({ id: labelTable.id, taskId: labelTable.taskId })
        .from(labelTable)
        .where(predicate)
        .orderBy(asc(labelTable.createdAt), asc(labelTable.id))
        .limit(remaining + 1);
      for (const row of rows.slice(0, remaining)) {
        // Recheck the snapshot/name if a concurrent edit changed this copy.
        const pending = await lease.transaction(async (tx) => {
          await tx
            .select({ id: taskTable.id })
            .from(taskTable)
            .where(eq(taskTable.id, row.taskId!))
            .for("no key update");
          const [deleted] = await tx
            .delete(labelTable)
            .where(and(eq(labelTable.id, row.id), predicate))
            .returning();
          if (!deleted) return;
          const [saved] = await tx
            .insert(labelDeletionTable)
            .values({ ...deleted, deletionId: id, userId })
            .returning();
          return saved;
        });
        if (pending) await completeLabelDeletion(pending, lease);
      }
      if (rows.length > remaining) return { ...root, pendingDeletion: true };
    }
    const [deleted] = await lease.transaction((tx) =>
      tx.delete(labelTable).where(eq(labelTable.id, id)).returning(),
    );
    if (!deleted) throw new HTTPException(404, { message: "Label not found" });
    return deleted;
  });
}

export default deleteLabel;
