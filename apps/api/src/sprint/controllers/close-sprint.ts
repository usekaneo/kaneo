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
  const { projectId, movedTaskIds } = await db.transaction(async (tx) => {
    // Claim the sprint row for update inside the transaction, so two
    // concurrent closes cannot both pass the active check and overwrite each
    // other's carry-over snapshot, and a concurrent sprint assignment
    // validates against the same state this close will commit.
    const [existing] = await tx
      .select()
      .from(sprintTable)
      .where(eq(sprintTable.id, id))
      .for("update");

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
      const [target] = await tx
        .select()
        .from(sprintTable)
        .where(eq(sprintTable.id, targetSprintId))
        .for("update");

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

    const moved = await tx
      .update(taskTable)
      .set({ sprintId: targetSprintId })
      .where(and(eq(taskTable.sprintId, id), sql`not ${taskIsCompleted}`))
      .returning({ id: taskTable.id, title: taskTable.title });

    // The claim is conditional on the sprint still being active: the row lock
    // serializes competing writers, and the condition guards against any
    // state change this transaction did not observe.
    const claimed = await tx
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
      .where(and(eq(sprintTable.id, id), eq(sprintTable.status, "active")))
      .returning({ id: sprintTable.id });

    if (!claimed.length) {
      throw new HTTPException(409, {
        message: "Sprint is no longer active and cannot be closed",
      });
    }

    return {
      projectId: existing.projectId,
      movedTaskIds: moved.map((task) => task.id),
    };
  });

  await publishEvent("sprint.updated", {
    projectId,
    sprintId: id,
  });

  return {
    sprint: await getSprint(projectId, id),
    movedTaskIds,
    targetSprintId,
  };
}

export default closeSprint;
