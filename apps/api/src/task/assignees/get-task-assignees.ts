import { eq, inArray, sql } from "drizzle-orm";
import db from "../../database";
import {
  taskTable,
  taskCoAssigneeTable,
  userTable,
} from "../../database/schema";
import type { DbOrTx } from "../../project-access/db-or-tx";

export type TaskAssignee = { id: string; name: string; image: string | null };

export async function getTaskAssignees(
  taskIds: string[],
  database: DbOrTx = db,
): Promise<Map<string, TaskAssignee[]>> {
  const byTask = new Map<string, TaskAssignee[]>();
  if (!taskIds.length) return byTask;
  // Keep imports/exports and large bulk operations below Postgres's bind limit.
  if (taskIds.length > 500) {
    for (let offset = 0; offset < taskIds.length; offset += 500) {
      for (const [id, people] of await getTaskAssignees(
        taskIds.slice(offset, offset + 500),
        database,
      ))
        byTask.set(id, people);
    }
    return byTask;
  }
  // Both parts of the set must come from one statement snapshot: a concurrent
  // replacement must not combine the previous first owner with the new others.
  const first = database
    .select({
      taskId: sql<string>`${taskTable.id}`.as("task_id"),
      id: sql<string>`${userTable.id}`.as("user_id"),
      name: userTable.name,
      image: userTable.image,
      order: sql<number>`0`.as("assignee_order"),
      assignedAt: sql<Date>`${taskTable.createdAt}`.as("assigned_at"),
    })
    .from(taskTable)
    .innerJoin(userTable, eq(userTable.id, taskTable.userId))
    .where(inArray(taskTable.id, taskIds));
  const others = database
    .select({
      taskId: sql<string>`${taskCoAssigneeTable.taskId}`.as("task_id"),
      id: sql<string>`${userTable.id}`.as("user_id"),
      name: userTable.name,
      image: userTable.image,
      order: sql<number>`1`.as("assignee_order"),
      assignedAt: sql<Date>`${taskCoAssigneeTable.createdAt}`.as("assigned_at"),
    })
    .from(taskCoAssigneeTable)
    .innerJoin(userTable, eq(userTable.id, taskCoAssigneeTable.userId))
    .where(inArray(taskCoAssigneeTable.taskId, taskIds));
  const rows = await first
    .unionAll(others)
    .orderBy(sql`"assignee_order"`, sql`"assigned_at"`, sql`"user_id"`);
  for (const { taskId, id, name, image } of rows) {
    const people = byTask.get(taskId) ?? [];
    if (!people.some((person) => person.id === id))
      people.push({ id, name, image });
    byTask.set(taskId, people);
  }
  return byTask;
}
