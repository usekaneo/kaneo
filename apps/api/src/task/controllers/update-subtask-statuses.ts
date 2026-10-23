import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import createNotification from "../../notification/controllers/create-notification";
import { subtaskStatusPreview } from "./subtask-status-preview";
import { publishTaskMutation } from "./task-mutation-effects";

export default async function updateSubtaskStatuses(
  id: string,
  status: string,
  taskIds: string[],
  userId: string,
  workspaceId: string,
) {
  const { changes, parent } = await db.transaction(
    async (tx) => {
      await tx.execute(sql`set local statement_timeout = '5s'`);
      await tx
        .select({ id: taskTable.id })
        .from(taskTable)
        .where(eq(taskTable.id, id))
        .for("update");
      const preview = await subtaskStatusPreview(
        tx,
        id,
        status,
        userId,
        workspaceId,
      );
      const selected = new Set(taskIds);
      const children = preview.subtasks.filter((child) =>
        selected.has(child.id),
      );
      // Already-closed children are deliberately left alone. Newly added children
      // are never changed unless they were included in the confirmation.
      if (children.some((child) => !child.destinationStatus))
        throw new HTTPException(400, {
          message: "A subtask project has no Done column",
        });
      const locked = children.length
        ? await tx
            .select()
            .from(taskTable)
            .where(
              inArray(
                taskTable.id,
                children.map((child) => child.id),
              ),
            )
            .orderBy(asc(taskTable.id))
            .for("update")
        : [];
      const changes = [];
      for (const before of locked) {
        const child = children.find((candidate) => candidate.id === before.id)!;
        const column =
          child.destinationStatus === "archived"
            ? undefined
            : await tx.query.columnTable.findFirst({
                where: and(
                  eq(columnTable.projectId, before.projectId),
                  eq(columnTable.slug, child.destinationStatus!),
                ),
              });
        const [after] = await tx
          .update(taskTable)
          .set({
            status: child.destinationStatus!,
            columnId: column?.id ?? null,
          })
          .where(eq(taskTable.id, before.id))
          .returning();
        if (after) changes.push({ before, after });
      }
      return { changes, parent: preview.parent };
    },
    { isolationLevel: "repeatable read" },
  );
  for (const { before, after } of changes) {
    await publishTaskMutation(before, after, userId, { fields: ["status"] });
    // The usual status event notifies the child's assignee. Also notify the
    // parent's assignee, without duplicates or bypassing resource access checks.
    if (
      parent.userId &&
      parent.userId !== after.userId &&
      parent.userId !== userId
    ) {
      await createNotification({
        userId: parent.userId,
        type: "task_status_changed",
        resourceId: after.id,
        resourceType: "task",
        eventData: {
          taskTitle: after.title,
          oldStatus: before.status,
          newStatus: after.status,
          projectId: after.projectId,
          workspaceId,
        },
      });
    }
  }
  return { success: true, updatedCount: changes.length };
}
