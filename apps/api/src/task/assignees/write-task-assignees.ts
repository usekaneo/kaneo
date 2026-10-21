import { HTTPException } from "hono/http-exception";
import { eq } from "drizzle-orm";
import { taskTable, taskCoAssigneeTable } from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";
import {
  assertAssignableUser,
  getProjectWorkspaceId,
} from "../../utils/assert-assignable-user";

// Callers hold the task row lock for the entire read/validate/write sequence.
export async function writeTaskAssignees(
  database: DbOrTx,
  task: { id: string; projectId: string },
  userIds: string[],
) {
  const ids = [...new Set(userIds.map((id) => id.trim()).filter(Boolean))];
  if (ids.length > 100)
    throw new HTTPException(400, {
      message: "A task can have at most 100 assignees",
    });
  const workspaceId = await getProjectWorkspaceId(task.projectId, database);
  for (const id of ids)
    await assertAssignableUser(id, workspaceId, task.projectId, database);
  await database
    .delete(taskCoAssigneeTable)
    .where(eq(taskCoAssigneeTable.taskId, task.id));
  const [first, ...others] = ids;
  if (others.length)
    await database.insert(taskCoAssigneeTable).values(
      others.map((userId, position) => ({
        taskId: task.id,
        userId,
        createdAt: new Date(Date.now() + position),
      })),
    );
  const [updated] = await database
    .update(taskTable)
    .set({ userId: first ?? null })
    .where(eq(taskTable.id, task.id))
    .returning();
  return updated!;
}
