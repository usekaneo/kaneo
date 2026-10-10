import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { sprintTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { taskIsCompleted } from "../../task/task-is-completed";
import { getSprint } from "./get-sprints";

// Closing a sprint freezes its history: completed tasks stay in the closed
// sprint, unfinished tasks move to a chosen future sprint or to the backlog.
async function closeSprint(id: string, targetSprintId: string | null) {
  const existing = await db.query.sprintTable.findFirst({
    where: eq(sprintTable.id, id),
  });

  if (!existing) {
    throw new HTTPException(404, { message: "Sprint not found" });
  }

  if (existing.status !== "active") {
    throw new HTTPException(409, {
      message:
        existing.status === "closed"
          ? "Sprint is already closed"
          : "Only the active sprint can be closed",
    });
  }

  if (targetSprintId) {
    const target = await db.query.sprintTable.findFirst({
      where: eq(sprintTable.id, targetSprintId),
    });

    if (!target || target.projectId !== existing.projectId) {
      throw new HTTPException(404, {
        message: "Target sprint not found in this project",
      });
    }

    if (target.status !== "future") {
      throw new HTTPException(400, {
        message: "Unfinished tasks can only move to a future sprint",
      });
    }
  }

  const movedTaskIds = await db.transaction(async (tx) => {
    const moved = await tx
      .update(taskTable)
      .set({ sprintId: targetSprintId })
      .where(
        and(eq(taskTable.sprintId, id), sql`not ${taskIsCompleted}`),
      )
      .returning({ id: taskTable.id, title: taskTable.title });

    await tx
      .update(sprintTable)
      .set({
        status: "closed",
        // Freeze the carried-over tasks in the sprint itself, so the report
        // of planned versus completed work survives the move.
        carryOverTasks: moved.map((task) => ({
          id: task.id,
          title: task.title,
        })),
      })
      .where(eq(sprintTable.id, id));

    return moved.map((task) => task.id);
  });

  await publishEvent("sprint.updated", {
    projectId: existing.projectId,
    sprintId: id,
  });

  return {
    sprint: await getSprint(existing.projectId, id),
    movedTaskIds,
    targetSprintId,
  };
}

export default closeSprint;
