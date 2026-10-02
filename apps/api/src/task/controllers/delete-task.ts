import { eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  assetTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { queueStorageCleanup } from "../../storage/cleanup-queue";
import getTask from "./get-task";

async function deleteTask(taskId: string, currentUserId: string) {
  const task = await getTask(taskId);

  const relations = await db
    .select()
    .from(taskRelationTable)
    .where(
      or(
        eq(taskRelationTable.sourceTaskId, taskId),
        eq(taskRelationTable.targetTaskId, taskId),
      ),
    )
    .execute();

  const deletedTask = await db.transaction(async (tx) => {
    const [locked] = await tx
      .select({ id: taskTable.id, projectId: taskTable.projectId })
      .from(taskTable)
      .where(eq(taskTable.id, taskId))
      .for("update");
    if (!locked) throw new HTTPException(404, { message: "Task not found" });
    if (locked.projectId !== task.projectId)
      throw new HTTPException(409, {
        message: "Task changed projects; retry the operation",
      });
    const assets = await tx
      .select({ objectKey: assetTable.objectKey })
      .from(assetTable)
      .where(eq(assetTable.taskId, taskId));
    await queueStorageCleanup(
      tx,
      assets.map((asset) => asset.objectKey),
    );
    const [deleted] = await tx
      .delete(taskTable)
      .where(eq(taskTable.id, taskId))
      .returning();
    return deleted;
  });

  if (!deletedTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  // The row read at the top may be stale by now: a concurrent reassignment
  // would leave the new assignee's "My tasks" view showing a deleted task.
  await publishEvent("task.deleted", {
    taskId: task.id,
    projectId: task.projectId,
    userId: currentUserId,
    assigneeId: deletedTask.userId,
    title: task.title,
  });

  for (const relation of relations) {
    await publishEvent("task-relation.deleted", {
      projectId: task.projectId,
      userId: currentUserId,
      taskId: taskId,
      sourceTaskId: relation.sourceTaskId,
      targetTaskId: relation.targetTaskId,
    });
  }

  return task;
}

export default deleteTask;
