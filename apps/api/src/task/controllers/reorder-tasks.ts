import { eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { VIRTUAL_STATUSES } from "../validate-task-fields";

type ReorderInput = {
  id: string;
  status: string;
  position: number;
};

// Postgres accepts at most 65535 bind parameters per statement and each task
// binds four, so the rows are written in chunks well inside that ceiling. This
// keeps a whole-column drag to a couple of statements instead of one per task.
const PARAMETERS_PER_TASK = 4;
const MAX_TASKS_PER_STATEMENT = Math.floor(60_000 / PARAMETERS_PER_TASK);

/**
 * Applies a whole board drag in one transaction.
 */
async function reorderTasks({
  projectId,
  tasks,
  currentUserId,
}: {
  projectId: string;
  tasks: ReorderInput[];
  currentUserId?: string;
}) {
  const ids = tasks.map((task) => task.id);

  if (new Set(ids).size !== ids.length) {
    throw new HTTPException(400, {
      message: "Duplicate task ids in reorder payload",
    });
  }

  const changed = await db.transaction(async (tx) => {
    // Serialize ordering writes per project so two concurrent drags cannot
    // interleave their renumbering and leave duplicate positions behind.
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(1526, hashtext(${projectId}))`,
    );

    const existing = await tx
      .select({
        id: taskTable.id,
        status: taskTable.status,
        position: taskTable.position,
        title: taskTable.title,
        userId: taskTable.userId,
        projectId: taskTable.projectId,
      })
      .from(taskTable)
      .where(inArray(taskTable.id, ids));

    const existingById = new Map(existing.map((task) => [task.id, task]));

    // Verify the whole batch before writing anything, so a smuggled foreign id
    // cannot leave the project half-renumbered. The route only authorizes the
    // one project in the path, so a task from anywhere else is rejected here
    // rather than silently skipped.
    for (const id of ids) {
      const task = existingById.get(id);

      if (!task) {
        throw new HTTPException(404, { message: `Task ${id} not found` });
      }

      if (task.projectId !== projectId) {
        throw new HTTPException(400, {
          message: `Task ${id} does not belong to this project`,
        });
      }
    }

    const columns = await tx
      .select({ id: columnTable.id, slug: columnTable.slug })
      .from(columnTable)
      .where(eq(columnTable.projectId, projectId));

    const columnIdBySlug = new Map(
      columns.map((column) => [column.slug, column.id]),
    );

    const requestedStatuses = new Set(tasks.map((task) => task.status));

    for (const status of requestedStatuses) {
      if (
        !columnIdBySlug.has(status) &&
        !(VIRTUAL_STATUSES as readonly string[]).includes(status)
      ) {
        const valid = [...columnIdBySlug.keys(), ...VIRTUAL_STATUSES];
        throw new HTTPException(400, {
          message: `Invalid status "${status}". Valid statuses for this project: ${valid.join(", ")}`,
        });
      }
    }

    // Tasks already sitting where the client asked for are skipped, so a drag
    // that only nudges one card does not rewrite its whole column.
    const pending = tasks.flatMap((task) => {
      const current = existingById.get(task.id);
      if (!current) return [];

      const statusChanged = current.status !== task.status;
      const positionChanged = current.position !== task.position;

      if (!statusChanged && !positionChanged) return [];

      return [{ task, current, statusChanged }];
    });

    // Set-based so the statement count scales with the chunk size rather than
    // with the number of tasks. Renumbering a long column row by row would just
    // move the flood of requests from the network onto the database.
    for (
      let offset = 0;
      offset < pending.length;
      offset += MAX_TASKS_PER_STATEMENT
    ) {
      const chunk = pending.slice(offset, offset + MAX_TASKS_PER_STATEMENT);

      const rows = sql.join(
        chunk.map(
          ({ task }) =>
            sql`(${task.id}::text, ${task.status}::text, ${
              columnIdBySlug.get(task.status) ?? null
            }::text, ${task.position}::integer)`,
        ),
        sql`, `,
      );

      // `updated_at` is set explicitly: raw SQL bypasses the `$onUpdate` hook
      // that the query builder would otherwise apply.
      await tx.execute(sql`
        UPDATE ${taskTable} AS t
        SET status = v.status,
            column_id = v.column_id,
            position = v.position,
            updated_at = now()
        FROM (VALUES ${rows}) AS v(id, status, column_id, position)
        WHERE t.id = v.id
      `);
    }

    return pending;
  });

  const statusChanges = changed.filter((entry) => entry.statusChanged);

  // Only a real column change is user-visible history. Position-only shuffles
  // deliberately produce no activity, notification, or integration traffic.
  for (const { task, current } of statusChanges) {
    await publishEvent("task.status_changed", {
      taskId: task.id,
      projectId,
      userId: currentUserId,
      oldStatus: current.status,
      newStatus: task.status,
      title: current.title,
      assigneeId: current.userId,
      type: "status_changed",
    });
  }

  if (statusChanges.length > 0) {
    await publishEvent("task-relation.refresh", {
      projectId,
      userId: currentUserId,
    });
  }

  // One broadcast for the whole drag. Reusing the task that changed status
  // keeps this from adding a second WebSocket message, because the batching in
  // `broadcastToProject` keys on type and task id.
  const primaryTaskId = statusChanges[0]?.task.id ?? changed[0]?.task.id;

  if (primaryTaskId) {
    await publishEvent("task.reordered", {
      taskId: primaryTaskId,
      projectId,
      userId: currentUserId,
    });
  }

  return {
    success: true,
    updatedCount: changed.length,
    tasks: changed.map(({ task }) => ({
      id: task.id,
      status: task.status,
      position: task.position,
    })),
  };
}

export default reorderTasks;
