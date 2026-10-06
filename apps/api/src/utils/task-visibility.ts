import { and, eq, inArray, isNull, or, type SQL } from "drizzle-orm";
import type { Context } from "hono";
import { HTTPException } from "hono/http-exception";
import db, { schema } from "../database";
import {
  hasWorkspacePermission,
  userHasWorkspacePermission,
} from "./require-workspace-permission";

const ASSIGN_TASKS = { task: ["assign"] };

export type TaskScopedResource =
  | "task"
  | "timeEntry"
  | "activity"
  | "comment"
  | "label";

// Anyone who may hand tasks out (task:assign — admins, owners, instance
// admins) sees every task in the workspace. Everyone else sees the tasks
// assigned to them plus the unclaimed ones, so the backlog stays pickable.
// Requires `workspaceId` to already be set on the context.
export async function restrictedAssigneeId(
  c: Context,
): Promise<string | undefined> {
  if (await hasWorkspacePermission(c, ASSIGN_TASKS)) {
    return undefined;
  }
  return c.get("userId");
}

// The task rows a restricted user may read. Pair it with `restrictedAssigneeId`
// so an unrestricted caller keeps an unfiltered query.
export function visibleTaskFilter(assigneeId: string): SQL | undefined {
  return or(
    eq(schema.taskTable.userId, assigneeId),
    isNull(schema.taskTable.userId),
  );
}

function isVisibleAssignee(
  taskAssigneeId: string | null,
  assigneeId: string,
): boolean {
  return taskAssigneeId === null || taskAssigneeId === assigneeId;
}

// The WebSocket fan-out asks this on every task mutation, once per connected
// user, so the answer is cached briefly rather than re-resolving the member's
// role for each message. A demotion therefore takes up to this long to stop the
// event ids; the API itself is never served from this cache.
const SEES_ALL_TASKS_TTL_MS = 5_000;
const seesAllTasksCache = new Map<
  string,
  { value: boolean; expiresAt: number }
>();

export function clearTaskVisibilityCache() {
  seesAllTasksCache.clear();
}

async function seesAllTasks(
  userId: string,
  workspaceId: string,
): Promise<boolean> {
  const key = `${workspaceId}:${userId}`;
  const now = Date.now();
  const cached = seesAllTasksCache.get(key);
  if (cached && cached.expiresAt > now) {
    return cached.value;
  }

  // Expired entries are only dropped on the next lookup for that key, so sweep
  // them here to keep the map bounded by the set of recently active users.
  if (seesAllTasksCache.size > 1_000) {
    for (const [entryKey, entry] of seesAllTasksCache) {
      if (entry.expiresAt <= now) seesAllTasksCache.delete(entryKey);
    }
  }

  const value = await userHasWorkspacePermission(
    userId,
    workspaceId,
    ASSIGN_TASKS,
  );
  seesAllTasksCache.set(key, {
    value,
    expiresAt: now + SEES_ALL_TASKS_TTL_MS,
  });
  return value;
}

// Narrows a realtime audience to the users allowed to know that `taskIds`
// changed. Unknown ids resolve to everyone: a task row is already gone by the
// time its delete event fans out, and withholding that event would leave the
// assignee's board showing a task that no longer exists.
export async function usersWhoCanSeeTasks(
  taskIds: string[],
  userIds: string[],
): Promise<Set<string>> {
  if (taskIds.length === 0 || userIds.length === 0) {
    return new Set(userIds);
  }

  const rows = await db
    .select({
      assigneeId: schema.taskTable.userId,
      workspaceId: schema.projectTable.workspaceId,
    })
    .from(schema.taskTable)
    .innerJoin(
      schema.projectTable,
      eq(schema.taskTable.projectId, schema.projectTable.id),
    )
    .where(inArray(schema.taskTable.id, taskIds));

  if (rows.length === 0) {
    return new Set(userIds);
  }

  // An unclaimed task is visible to the whole workspace, so its events are too.
  if (rows.some((row) => row.assigneeId === null)) {
    return new Set(userIds);
  }

  const assignees = new Set(
    rows.flatMap((row) => (row.assigneeId ? [row.assigneeId] : [])),
  );
  const workspaceIds = [...new Set(rows.map((row) => row.workspaceId))];
  const allowed = new Set<string>();

  for (const userId of userIds) {
    if (assignees.has(userId)) {
      allowed.add(userId);
      continue;
    }
    for (const workspaceId of workspaceIds) {
      if (await seesAllTasks(userId, workspaceId)) {
        allowed.add(userId);
        break;
      }
    }
  }

  return allowed;
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

  if (tasks.some((task) => !isVisibleAssignee(task.userId, assigneeId))) {
    throw new HTTPException(404, { message: "Task not found" });
  }
}
