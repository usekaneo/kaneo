import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import { withLockedTask } from "./with-locked-task";
import { taskTable } from "../../database/schema";
import { publishTaskMutation } from "./task-mutation-effects";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";

async function updateTaskAssignee({
  id,
  userId,
  currentUserId,
}: {
  id: string;
  userId: string | null;
  currentUserId: string;
}) {
  const { before: existingTask, after: updatedTask } = await withLockedTask(
    id,
    async (tx, existingTask) => {
      const nextAssigneeId = userId?.trim() || null;
      if (existingTask.userId === nextAssigneeId) {
        return existingTask;
      }

      if (nextAssigneeId) {
        await assertAssignableUser(
          nextAssigneeId,
          await getProjectWorkspaceId(existingTask.projectId, tx),
          tx,
        );
      }

      const [updatedTask] = await tx
        .update(taskTable)
        .set({ userId: nextAssigneeId })
        .where(eq(taskTable.id, id))
        .returning();

      if (!updatedTask) {
        throw new HTTPException(500, {
          message: "Failed to update task assignee",
        });
      }

      return updatedTask;
    },
  );

  await publishTaskMutation(existingTask, updatedTask, currentUserId, {
    fields: ["userId"],
  });

  return updatedTask;
}

export default updateTaskAssignee;
