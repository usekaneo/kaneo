import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { globalBoardOrderTable, taskTable } from "../../database/schema";
import type { PermissionMap } from "../../utils/role-permissions";
import reorderTasks from "../controllers/reorder-tasks";
import { loadBoardScope } from "./board-scope";
import { placeInOrder } from "./place-in-order";
import { placeInProjectColumn } from "./place-in-project-column";

/**
 * Saves where the caller dropped a card on the global board: their personal
 * lane order always, and, when they may update tasks, the task's column and
 * its place among same-project neighbours on the project board.
 */
async function moveGlobalBoardTask({
  userId,
  apiKeyScope,
  taskId,
  status,
  visibleTaskIds,
  canUpdateProject,
  autoAssigneeId,
}: {
  userId: string;
  apiKeyScope: PermissionMap | null;
  taskId: string;
  status?: string;
  visibleTaskIds: string[];
  canUpdateProject: boolean;
  autoAssigneeId: string | null;
}) {
  const [task] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      status: taskTable.status,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);
  if (!task) throw new HTTPException(404, { message: "Task not found" });

  const targetStatus = status ?? task.status;
  const statusChanged = targetStatus !== task.status;
  if (statusChanged && !canUpdateProject)
    throw new HTTPException(403, { message: "Insufficient permissions" });

  // Only cards the caller can see on the board may shape the order.
  const scope = await loadBoardScope(userId, apiKeyScope);
  const visibleProjects = new Set(scope.projects.map((project) => project.id));
  const requested = [...new Set([...visibleTaskIds, taskId])];
  const known = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      status: taskTable.status,
    })
    .from(taskTable)
    .where(inArray(taskTable.id, requested));
  const byId = new Map(
    known
      .filter((row) => visibleProjects.has(row.projectId))
      .map((row) => [row.id, row]),
  );
  if (!byId.has(taskId))
    throw new HTTPException(404, { message: "Task not found" });
  const laneTasks = visibleTaskIds.flatMap((id) => {
    const row = byId.get(id);
    if (!row) return [];
    return [id === taskId ? { ...row, status: targetStatus } : row];
  });
  if (!laneTasks.some((row) => row.id === taskId))
    throw new HTTPException(400, {
      message: "visibleTaskIds must include the moved task",
    });

  const saved = await db
    .select({
      taskId: globalBoardOrderTable.taskId,
      position: globalBoardOrderTable.position,
    })
    .from(globalBoardOrderTable)
    .where(
      and(
        eq(globalBoardOrderTable.userId, userId),
        inArray(
          globalBoardOrderTable.taskId,
          laneTasks.map((row) => row.id),
        ),
      ),
    );
  const writes = placeInOrder(
    laneTasks.map((row) => row.id),
    taskId,
    new Map(saved.map((row) => [row.taskId, row.position])),
  );

  let projectUpdate: Parameters<typeof reorderTasks> | null = null;
  if (canUpdateProject) {
    const columns = await db
      .select({
        id: taskTable.id,
        position: taskTable.position,
        status: taskTable.status,
      })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.projectId, task.projectId),
          inArray(taskTable.status, [...new Set([task.status, targetStatus])]),
        ),
      )
      .orderBy(asc(taskTable.position), asc(taskTable.id));
    const order = placeInProjectColumn({
      laneTasks,
      task: { id: taskId, projectId: task.projectId, status: targetStatus },
      columnIds: columns
        .filter((row) => row.status === targetStatus && row.id !== taskId)
        .map((row) => row.id),
      statusChanged,
    });
    if (order) {
      const current = new Map(columns.map((row) => [row.id, row]));
      const changed = order.flatMap((id, position) => {
        const row = current.get(id);
        if (id === taskId)
          return [
            {
              id,
              position,
              ...(statusChanged ? { status: targetStatus } : {}),
            },
          ];
        return row?.position === position ? [] : [{ id, position }];
      });
      if (changed.length)
        projectUpdate = [
          task.projectId,
          changed,
          userId,
          columns.map(({ id, position, status }) => ({ id, position, status })),
          autoAssigneeId,
        ];
    }
  }

  // The project write can reject a stale board, so it runs before saving the
  // personal order the caller will see.
  if (projectUpdate) await reorderTasks(...projectUpdate);
  if (writes.size)
    await db
      .insert(globalBoardOrderTable)
      .values(
        [...writes].map(([id, position]) => ({ userId, taskId: id, position })),
      )
      .onConflictDoUpdate({
        target: [globalBoardOrderTable.userId, globalBoardOrderTable.taskId],
        set: { position: sql`excluded.position` },
      });

  return { id: taskId, status: targetStatus };
}

export default moveGlobalBoardTask;
