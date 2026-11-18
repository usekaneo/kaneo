import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";

// Sprint assignment may only move a task between the backlog and the current
// or upcoming sprints. A closed sprint accepts no new tasks, and a task that
// belongs to a closed sprint stays there as history.
async function updateTaskSprint({
  taskId,
  sprintId,
  currentUserId,
}: {
  taskId: string;
  sprintId: string | null;
  currentUserId: string;
}) {
  const task = await db.query.taskTable.findFirst({
    where: eq(taskTable.id, taskId),
  });

  if (!task) {
    throw new HTTPException(404, { message: "Task not found" });
  }

  if (task.sprintId) {
    const currentSprint = await db.query.sprintTable.findFirst({
      where: eq(sprintTable.id, task.sprintId),
    });

    if (currentSprint?.status === "closed") {
      throw new HTTPException(409, {
        message:
          "The task belongs to a closed sprint and stays there as implementation history",
      });
    }
  }

  if (sprintId) {
    const targetSprint = await db.query.sprintTable.findFirst({
      where: eq(sprintTable.id, sprintId),
    });

    if (!targetSprint || targetSprint.projectId !== task.projectId) {
      throw new HTTPException(404, {
        message: "Target sprint not found in this project",
      });
    }

    if (targetSprint.status === "closed") {
      throw new HTTPException(409, {
        message: "Cannot assign tasks to a closed sprint",
      });
    }

    if (targetSprint.status !== "active" && targetSprint.status !== "future") {
      throw new HTTPException(400, {
        message: "Target sprint is not an active or upcoming sprint",
      });
    }
  }

  const [updated] = await db
    .update(taskTable)
    .set({ sprintId })
    .where(eq(taskTable.id, taskId))
    .returning({
      id: taskTable.id,
      projectId: taskTable.projectId,
      sprintId: taskTable.sprintId,
    });

  if (!updated) {
    throw new HTTPException(500, {
      message: "Failed to update the task's sprint",
    });
  }

  await publishEvent("task.sprint_changed", {
    taskId: updated.id,
    projectId: updated.projectId,
    userId: currentUserId,
  });

  await publishEvent("sprint.updated", { projectId: updated.projectId });

  return updated;
}

export default updateTaskSprint;
