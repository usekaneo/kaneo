import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { projectTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { assertValidTaskType } from "../validate-task-fields";

async function updateTaskType({
  id,
  taskType,
  currentUserId,
}: {
  id: string;
  taskType: string;
  currentUserId: string;
}) {
  const [existingTask] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      title: taskTable.title,
      taskType: taskTable.taskType,
    })
    .from(taskTable)
    .where(eq(taskTable.id, id))
    .limit(1);

  if (!existingTask) {
    throw new HTTPException(404, {
      message: "Task not found",
    });
  }

  const [project] = await db
    .select({ projectType: projectTable.projectType })
    .from(projectTable)
    .where(eq(projectTable.id, existingTask.projectId))
    .limit(1);

  assertValidTaskType(taskType, project?.projectType ?? null);

  const [updatedTask] = await db
    .update(taskTable)
    .set({ taskType })
    .where(eq(taskTable.id, id))
    .returning();

  if (!updatedTask) {
    throw new HTTPException(500, {
      message: "Failed to update task type",
    });
  }

  await publishEvent("task.updated", {
    taskId: updatedTask.id,
    projectId: updatedTask.projectId,
    title: updatedTask.title,
    status: updatedTask.status,
    userId: currentUserId,
  });

  return updatedTask;
}

export default updateTaskType;
