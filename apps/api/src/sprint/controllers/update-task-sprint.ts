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

  // The sprint checks and the write run in one transaction under row locks,
  // so a sprint cannot be closed (or otherwise change its status) between
  // validation and the task write.
  const updated = await db.transaction(async (tx) => {
    if (task.sprintId) {
      const [currentSprint] = await tx
        .select()
        .from(sprintTable)
        .where(eq(sprintTable.id, task.sprintId))
        .for("update");

      if (currentSprint?.status === "closed") {
        throw new HTTPException(409, {
          message:
            "The task belongs to a closed sprint and stays there as implementation history",
        });
      }
    }

    if (sprintId) {
      const [targetSprint] = await tx
        .select()
        .from(sprintTable)
        .where(eq(sprintTable.id, sprintId))
        .for("update");

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

      if (
        targetSprint.status !== "active" &&
        targetSprint.status !== "future"
      ) {
        throw new HTTPException(400, {
          message: "Target sprint is not an active or upcoming sprint",
        });
      }
    }

    return tx
      .update(taskTable)
      .set({ sprintId })
      .where(eq(taskTable.id, taskId))
      .returning({
        id: taskTable.id,
        projectId: taskTable.projectId,
        sprintId: taskTable.sprintId,
      });
  });

  if (!updated.length) {
    throw new HTTPException(500, {
      message: "Failed to update the task's sprint",
    });
  }

  await publishEvent("task.sprint_changed", {
    taskId: updated[0].id,
    projectId: updated[0].projectId,
    userId: currentUserId,
  });

  await publishEvent("sprint.updated", { projectId: updated[0].projectId });

  return updated[0];
}

export default updateTaskSprint;
