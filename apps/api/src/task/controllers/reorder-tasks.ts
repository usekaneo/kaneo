import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { columnTable, taskTable } from "../../database/schema";
import { publishEvent } from "../../events";
import { assertValidTaskStatus } from "../validate-task-fields";
import { assertTaskPosition } from "./next-task-position";
import { publishTaskMutation } from "./task-mutation-effects";

type Reorder = { id: string; position: number; status?: string };
export default async function reorderTasks(
  projectId: string,
  tasks: Reorder[],
  userId: string,
) {
  if (new Set(tasks.map((task) => task.id)).size !== tasks.length)
    throw new HTTPException(400, { message: "Task IDs must be unique" });
  for (const task of tasks) assertTaskPosition(task.position);
  const statuses = [
    ...new Set(
      tasks.flatMap((task) => (task.status === undefined ? [] : [task.status])),
    ),
  ];
  const columns = new Map<string, string | null>();
  for (const status of statuses) {
    await assertValidTaskStatus(status, projectId);
    const column = await db.query.columnTable.findFirst({
      where: and(
        eq(columnTable.projectId, projectId),
        eq(columnTable.slug, status),
      ),
    });
    columns.set(status, column?.id ?? null);
  }
  const { before, after } = await db.transaction(async (tx) => {
    // Lock all affected cards together; a concurrent move cannot escape the
    // scope check between reading their current state and writing positions.
    const before = await tx
      .select({ id: taskTable.id, status: taskTable.status })
      .from(taskTable)
      .where(
        and(
          eq(taskTable.projectId, projectId),
          inArray(
            taskTable.id,
            tasks.map((task) => task.id),
          ),
        ),
      )
      .orderBy(asc(taskTable.id))
      .for("update");
    if (before.length !== tasks.length)
      throw new HTTPException(404, {
        message: "Tasks must belong to the requested project",
      });
    const values = tasks.map((task) => ({
      id: task.id,
      position: task.position,
      status: task.status ?? null,
      column_id:
        task.status === undefined ? null : (columns.get(task.status) ?? null),
    }));
    // One JSON parameter keeps large boards below PostgreSQL's bind limit.
    const after = await tx
      .update(taskTable)
      .set({
        position: sql`changes.position`,
        status: sql`coalesce(changes.status, ${taskTable.status})`,
        columnId: sql`case when changes.status is null then ${taskTable.columnId} else changes.column_id end`,
      })
      .from(
        sql`jsonb_to_recordset(${JSON.stringify(values)}::jsonb) as changes(id text, position integer, status text, column_id text)`,
      )
      .where(
        and(
          eq(taskTable.projectId, projectId),
          sql`${taskTable.id} = changes.id`,
        ),
      )
      .returning({
        id: taskTable.id,
        position: taskTable.position,
        status: taskTable.status,
        projectId: taskTable.projectId,
        title: taskTable.title,
        userId: taskTable.userId,
      });
    if (after.length !== tasks.length)
      throw new HTTPException(409, {
        message: "Task changed projects; retry the move",
      });
    return { before, after };
  });
  const beforeById = new Map(before.map((task) => [task.id, task]));
  let statusChanged = false;
  for (const updated of after) {
    const prior = beforeById.get(updated.id)!;
    if (prior.status !== updated.status) statusChanged = true;
    await publishTaskMutation(prior, updated, userId, {
      fields: ["status"],
      skipRelationRefresh: true,
    });
  }
  if (statusChanged)
    await publishEvent("task-relation.refresh", { projectId, userId });
  await publishEvent("tasks.reordered", {
    projectId,
    userId,
    tasks: after.map(({ id, position, status }) => ({ id, position, status })),
  });
  return after.map(({ id, position, status }) => ({
    id,
    position: position ?? 0,
    status,
  }));
}
