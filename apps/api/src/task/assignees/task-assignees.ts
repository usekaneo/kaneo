import {
  and,
  asc,
  eq,
  inArray,
  isNotNull,
  isNull,
  ne,
  notInArray,
  or,
  sql,
  type SQL,
} from "drizzle-orm";
import type { DbOrTx } from "../../project-access/db-or-tx";
import { taskAssignedTo } from "./task-assigned-to";
import { schema } from "../../database";
import {
  diffAssigneeIds,
  normalizeAssigneeIds,
  pickPrimaryAssignee,
} from "./assignee-set";

const { taskAssigneeTable, taskTable, userTable } = schema;

export type TaskAssignee = {
  id: string;
  name: string;
  image: string | null;
};

type AssignedRow = { id: string; userId: string | null };

const CHUNK = 5000;

// The ids of every assignee, primary first. The primary is always included so
// tasks written without a task_assignee row (older code paths) still read right.
export async function loadAssigneeIds(
  rows: readonly AssignedRow[],
  database: DbOrTx,
): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  for (const row of rows) result.set(row.id, row.userId ? [row.userId] : []);

  for (let i = 0; i < rows.length; i += CHUNK) {
    const links = await database
      .select({
        taskId: taskAssigneeTable.taskId,
        userId: taskAssigneeTable.userId,
      })
      .from(taskAssigneeTable)
      .where(
        inArray(
          taskAssigneeTable.taskId,
          rows.slice(i, i + CHUNK).map((row) => row.id),
        ),
      )
      .orderBy(asc(taskAssigneeTable.createdAt), asc(taskAssigneeTable.id));
    for (const link of links) {
      const ids = result.get(link.taskId);
      if (ids && !ids.includes(link.userId)) ids.push(link.userId);
    }
  }
  return result;
}

export async function loadAssignees<T extends AssignedRow>(
  rows: readonly T[],
  database: DbOrTx,
): Promise<Map<string, TaskAssignee[]>> {
  const idsByTask = await loadAssigneeIds(rows, database);
  const userIds = [...new Set([...idsByTask.values()].flat())];
  const users = new Map<string, TaskAssignee>();
  for (let i = 0; i < userIds.length; i += CHUNK) {
    const found = await database
      .select({
        id: userTable.id,
        name: userTable.name,
        image: userTable.image,
      })
      .from(userTable)
      .where(inArray(userTable.id, userIds.slice(i, i + CHUNK)));
    for (const user of found) users.set(user.id, user);
  }
  const result = new Map<string, TaskAssignee[]>();
  for (const [taskId, ids] of idsByTask) {
    result.set(
      taskId,
      ids.flatMap((id) => users.get(id) ?? []),
    );
  }
  return result;
}

// Adds `assignees`/`assigneeIds` to task rows that already carry the primary
// assignee's fields. If the primary was deleted with its user, the next
// assignee takes over those fields.
export async function withAssignees<
  T extends AssignedRow & {
    assigneeId?: string | null;
    assigneeName?: string | null;
    assigneeImage?: string | null;
  },
>(rows: readonly T[], database: DbOrTx) {
  if (rows.length === 0) return [];
  const assignees = await loadAssignees(rows, database);
  return rows.map((row) => {
    const list = assignees.get(row.id) ?? [];
    const primary = row.userId ? undefined : list[0];
    return {
      ...row,
      ...(primary
        ? {
            userId: primary.id,
            assigneeId: primary.id,
            assigneeName: primary.name,
            ...("assigneeImage" in row ? { assigneeImage: primary.image } : {}),
          }
        : {}),
      assigneeIds: list.map((user) => user.id),
      assignees: list,
    };
  });
}

// Replaces a task's assignee set and keeps task.userId pointing at the primary.
// Callers validate the people first (assertAssignableUsers) and hold the task lock.
export async function replaceTaskAssignees(
  tx: DbOrTx,
  task: { id: string; userId: string | null },
  requestedIds: readonly string[],
) {
  const ids = normalizeAssigneeIds(requestedIds);
  const before = (await loadAssigneeIds([task], tx)).get(task.id) ?? [];
  const { added, removed } = diffAssigneeIds(before, ids);

  // Rows are written for everyone in the set, not just the newly added: the
  // primary of an older task may not have a row yet.
  await tx
    .delete(taskAssigneeTable)
    .where(
      and(
        eq(taskAssigneeTable.taskId, task.id),
        ids.length > 0 ? notInArray(taskAssigneeTable.userId, ids) : undefined,
      ),
    );
  if (ids.length > 0) {
    // Staggered so the order people were picked in survives a reload.
    const base = Date.now();
    await tx
      .insert(taskAssigneeTable)
      .values(
        ids.map((userId, index) => ({
          taskId: task.id,
          userId,
          createdAt: new Date(base + index),
        })),
      )
      .onConflictDoNothing();
  }

  const primary = pickPrimaryAssignee(task.userId, ids);
  const needsPrimaryWrite = primary !== task.userId;
  const [updated] = needsPrimaryWrite
    ? await tx
        .update(taskTable)
        .set({ userId: primary })
        .where(eq(taskTable.id, task.id))
        .returning()
    : [];

  return { ids, before, added, removed, primary, updated };
}

// Drops assignees outside `keepUserIds` from the tasks matching `taskScope` and
// re-points each affected primary at a remaining assignee (or clears it).
// Returns the ids of the tasks that lost anyone.
export async function pruneAssignees(
  tx: DbOrTx,
  taskScope: SQL | undefined,
  keepUserIds: ReadonlySet<string>,
): Promise<string[]> {
  const keep = [...keepUserIds];
  // Lock the tasks before touching their assignee rows, in id order. Every other
  // writer takes the task lock first; deleting rows first would invert that
  // order and deadlock against a concurrent assignee change.
  await tx
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(taskScope)
    .orderBy(asc(taskTable.id))
    .for("update");
  const scopedTasks = tx
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(taskScope);

  const dropped = await tx
    .delete(taskAssigneeTable)
    .where(
      and(
        inArray(taskAssigneeTable.taskId, scopedTasks),
        keep.length > 0
          ? notInArray(taskAssigneeTable.userId, keep)
          : undefined,
      ),
    )
    .returning({ taskId: taskAssigneeTable.taskId });

  const repointed = await tx
    .update(taskTable)
    .set({
      userId: sql`(
        select ${taskAssigneeTable.userId} from ${taskAssigneeTable}
        where ${taskAssigneeTable.taskId} = ${taskTable.id}
        order by ${taskAssigneeTable.createdAt}, ${taskAssigneeTable.id}
        limit 1
      )`,
    })
    .where(
      and(
        taskScope,
        isNotNull(taskTable.userId),
        keep.length > 0 ? notInArray(taskTable.userId, keep) : undefined,
      ),
    )
    .returning({ id: taskTable.id });

  return [
    ...new Set([
      ...dropped.map((row) => row.taskId),
      ...repointed.map((row) => row.id),
    ]),
  ];
}

// Takes one person off every task matching `taskScope`, re-pointing the primary
// where they held it. Returns the tasks they were removed from.
export async function removeAssignee(
  tx: DbOrTx,
  userId: string,
  taskScope: SQL | undefined,
): Promise<{ id: string; projectId: string }[]> {
  // Locked in id order, before the assignee rows change, to match every other
  // writer's task-then-rows order.
  const affected = await tx
    .select({ id: taskTable.id, projectId: taskTable.projectId })
    .from(taskTable)
    .where(and(taskScope, taskAssignedTo(userId)))
    .orderBy(asc(taskTable.id))
    .for("update");
  if (affected.length === 0) return [];

  await tx
    .delete(taskAssigneeTable)
    .where(
      and(
        eq(taskAssigneeTable.userId, userId),
        inArray(
          taskAssigneeTable.taskId,
          tx.select({ id: taskTable.id }).from(taskTable).where(taskScope),
        ),
      ),
    );
  await tx
    .update(taskTable)
    .set({
      userId: sql`(
        select ${taskAssigneeTable.userId} from ${taskAssigneeTable}
        where ${taskAssigneeTable.taskId} = ${taskTable.id}
        order by ${taskAssigneeTable.createdAt}, ${taskAssigneeTable.id}
        limit 1
      )`,
    })
    .where(and(taskScope, eq(taskTable.userId, userId)));
  return affected;
}

// Bulk form of replaceTaskAssignees for "one person replaces everyone": three
// statements however many tasks there are, instead of several per task. The
// person becomes primary on every task. Callers hold the task locks.
export async function replaceAssigneesWithOne(
  tx: DbOrTx,
  tasks: readonly { id: string; userId: string | null }[],
  assigneeId: string | null,
) {
  const changes = new Map<
    string,
    { added: string[]; removed: string[]; primary: string | null }
  >();
  if (tasks.length === 0) return changes;

  const taskIds = tasks.map((task) => task.id);
  const before = await loadAssigneeIds(tasks, tx);
  const after = assigneeId ? [assigneeId] : [];
  for (const task of tasks) {
    const { added, removed } = diffAssigneeIds(
      before.get(task.id) ?? [],
      after,
    );
    changes.set(task.id, { added, removed, primary: assigneeId });
  }

  await tx
    .delete(taskAssigneeTable)
    .where(
      and(
        inArray(taskAssigneeTable.taskId, taskIds),
        assigneeId ? ne(taskAssigneeTable.userId, assigneeId) : undefined,
      ),
    );
  if (assigneeId) {
    await tx
      .insert(taskAssigneeTable)
      .values(taskIds.map((taskId) => ({ taskId, userId: assigneeId })))
      .onConflictDoNothing();
  }
  await tx
    .update(taskTable)
    .set({ userId: assigneeId })
    .where(
      and(
        inArray(taskTable.id, taskIds),
        assigneeId
          ? or(isNull(taskTable.userId), ne(taskTable.userId, assigneeId))
          : isNotNull(taskTable.userId),
      ),
    );

  return changes;
}

// Of these tasks, the ones with nobody assigned any more. The primary is
// repointed to the next assignee whenever one remains, so a null primary means
// the task is empty. Chunked to stay under the bind-parameter limit.
export async function filterUnassignedTasks(
  tx: DbOrTx,
  taskIds: readonly string[],
): Promise<string[]> {
  const unassigned: string[] = [];
  for (let start = 0; start < taskIds.length; start += 5000) {
    const rows = await tx
      .select({ id: taskTable.id })
      .from(taskTable)
      .where(
        and(
          inArray(taskTable.id, taskIds.slice(start, start + 5000)),
          isNull(taskTable.userId),
        ),
      );
    unassigned.push(...rows.map((row) => row.id));
  }
  return unassigned;
}
