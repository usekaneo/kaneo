import { and, eq, getTableColumns, inArray, sql } from "drizzle-orm";
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
      .select({ ...getTableColumns(taskTable), description: sql<null>`null` })
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
      .for("update");
    if (before.length !== tasks.length)
      throw new HTTPException(404, {
        message: "Tasks must belong to the requested project",
      });
    const statusChanges = tasks.filter(
      (task): task is Reorder & { status: string } => task.status !== undefined,
    );
    const position = sql<number>`case ${taskTable.id} ${sql.join(
      tasks.map((task) => sql`when ${task.id} then ${task.position}::integer`),
      sql` `,
    )} else ${taskTable.position} end`;
    const status = statusChanges.length
      ? sql<string>`case ${taskTable.id} ${sql.join(
          statusChanges.map((task) => sql`when ${task.id} then ${task.status}`),
          sql` `,
        )} else ${taskTable.status} end`
      : undefined;
    const columnId = statusChanges.length
      ? sql<string | null>`case ${taskTable.id} ${sql.join(
          statusChanges.map(
            (task) =>
              sql`when ${task.id} then ${columns.get(task.status) ?? null}`,
          ),
          sql` `,
        )} else ${taskTable.columnId} end`
      : undefined;
    const after = await tx
      .update(taskTable)
      .set({ position, ...(statusChanges.length ? { status, columnId } : {}) })
      .where(
        and(
          eq(taskTable.projectId, projectId),
          inArray(
            taskTable.id,
            tasks.map((task) => task.id),
          ),
        ),
      )
      .returning({
        ...getTableColumns(taskTable),
        description: sql<null>`null`,
      });
    if (after.length !== tasks.length)
      throw new HTTPException(409, {
        message: "Task changed projects; retry the move",
      });
    return { before, after };
  });
  for (const updated of after)
    await publishTaskMutation(
      {
        ...before.find((task) => task.id === updated.id)!,
        description: undefined,
      },
      updated,
      userId,
    );
  await publishEvent("tasks.reordered", {
    projectId,
    userId,
    tasks: after.map(({ id, position, status }) => ({ id, position, status })),
  });
  return after.map((task) => ({ ...task, descriptionDeferred: true }));
}
