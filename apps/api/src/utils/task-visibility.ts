import { and, eq, inArray } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import { hasWorkspacePermission } from "./require-workspace-permission";

export type TaskScopedResource =
  | "task"
  | "timeEntry"
  | "activity"
  | "comment"
  | "label";

// Anyone who may hand tasks out (task:assign — admins, owners, instance
// admins) sees every task in the workspace. Everyone else only sees the tasks
// assigned to them. Requires `workspaceId` to already be set on the context.
export async function restrictedAssigneeId(
  c: Context,
): Promise<string | undefined> {
  if (await hasWorkspacePermission(c, { task: ["assign"] })) {
    return undefined;
  }
  return c.get("userId");
}

async function taskIdsFor(
  resource: TaskScopedResource,
  ids: string[],
): Promise<string[]> {
  if (resource === "task") return ids;

  if (resource === "timeEntry") {
    const rows = await db
      .select({ taskId: schema.timeEntryTable.taskId })
      .from(schema.timeEntryTable)
      .where(inArray(schema.timeEntryTable.id, ids));
    return rows.map((row) => row.taskId);
  }

  // Labels without a task are workspace-wide and stay visible to everyone.
  if (resource === "label") {
    const rows = await db
      .select({ taskId: schema.labelTable.taskId })
      .from(schema.labelTable)
      .where(inArray(schema.labelTable.id, ids));
    return rows.flatMap((row) => (row.taskId ? [row.taskId] : []));
  }

  const rows = await db
    .select({ taskId: schema.activityTable.taskId })
    .from(schema.activityTable)
    .where(
      resource === "comment"
        ? and(
            inArray(schema.activityTable.id, ids),
            eq(schema.activityTable.type, "comment"),
          )
        : inArray(schema.activityTable.id, ids),
    );
  return rows.map((row) => row.taskId);
}

// Answers 404 rather than 403 so restricted users can't probe which task ids
// exist.
export async function assertTasksVisible(
  c: Context,
  resource: TaskScopedResource,
  ids: string[],
) {
  if (ids.length === 0) return;

  const assigneeId = await restrictedAssigneeId(c);
  if (!assigneeId) return;

  const taskIds = [...new Set(await taskIdsFor(resource, ids))];
  if (taskIds.length === 0) return;

  const tasks = await db
    .select({ userId: schema.taskTable.userId })
    .from(schema.taskTable)
    .where(inArray(schema.taskTable.id, taskIds));

  if (tasks.some((task) => task.userId !== assigneeId)) {
    throw new HTTPException(404, { message: "Task not found" });
  }
}
