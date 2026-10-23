import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { withLockedTask } from "./with-locked-task";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { publishTaskMutation } from "./task-mutation-effects";
import {
  assertValidTaskStatus,
  VIRTUAL_STATUSES,
} from "../validate-task-fields";

const isVirtualStatus = (status: string) =>
  (VIRTUAL_STATUSES as readonly string[]).includes(status);

async function updateTaskStatus({
  id,
  status,
  currentUserId,
  autoAssigneeId = null,
}: {
  id: string;
  status: string;
  currentUserId: string;
  // Fills an empty assignee when the task moves to another board column;
  // sending it to the backlog or archive leaves it unassigned.
  autoAssigneeId?: string | null;
}) {
  const { before: existingTask, after: updatedTask } = await withLockedTask(
    id,
    async (tx, existingTask) => {
      await assertValidTaskStatus(status, existingTask.projectId, tx);

      const column = await tx.query.columnTable.findFirst({
        where: and(
          eq(columnTable.projectId, existingTask.projectId),
          eq(columnTable.slug, status),
        ),
      });

      const [updatedTask] = await tx
        .update(taskTable)
        .set({
          status,
          columnId: column?.id ?? null,
          ...(autoAssigneeId &&
          !existingTask.userId &&
          existingTask.status !== status &&
          !isVirtualStatus(status)
            ? { userId: autoAssigneeId }
            : {}),
        })
        .where(eq(taskTable.id, id))
        .returning();

      if (!updatedTask) {
        throw new HTTPException(500, {
          message: "Failed to update task status",
        });
      }

      return updatedTask;
    },
  );

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["status", "userId"],
  });

  if (
    existingTask.status === updatedTask.status &&
    existingTask.columnId !== updatedTask.columnId
  )
    await publishEvent("task.updated", {
      taskId: updatedTask.id,
      projectId: updatedTask.projectId,
      userId: currentUserId,
    });

  return updatedTask;
}

export default updateTaskStatus;
