import { and, asc, eq, inArray, sql, isNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  taskTable,
  taskCoAssigneeTable,
  userTable,
} from "../../database/schema";
import { assertAssignableUser } from "../../utils/assert-assignable-user";
import { publishEvent } from "../../events";
import { getTaskAssignees } from "./get-task-assignees";
import { publishAssigneeChanges } from "./publish-assignee-changes";

export async function bulkChangeTaskAssignees({
  tasks,
  workspaceId,
  value,
  userId,
  assigneeMode,
}: {
  tasks: { id: string; projectId: string }[];
  workspaceId: string;
  value?: string | null;
  userId: string;
  assigneeMode: "set" | "add" | "remove";
}) {
  const foundIds = tasks.map((task) => task.id);
  const assigneeId = value?.trim() || null;

  if (assigneeMode !== "set" && !assigneeId)
    throw new HTTPException(400, {
      message: "An assignee is required for add/remove",
    });
  if (assigneeId && assigneeMode !== "remove") {
    await assertAssignableUser(
      assigneeId,
      workspaceId,
      tasks.map((task) => task.projectId),
    );
  }

  // A replacement has one known result shared by all tasks. Resolve its name
  // once rather than reading the same profile again for every updated task.
  const replacement =
    assigneeMode === "set" && assigneeId
      ? await db.query.userTable.findFirst({
          columns: { id: true, name: true, image: true },
          where: eq(userTable.id, assigneeId),
        })
      : undefined;

  const changes = await db.transaction(async (tx) => {
    const locked = await tx
      .select({
        id: taskTable.id,
        projectId: taskTable.projectId,
        title: taskTable.title,
        userId: taskTable.userId,
      })
      .from(taskTable)
      .where(inArray(taskTable.id, foundIds))
      .orderBy(asc(taskTable.id))
      .for("update");
    const originalProjects = new Map(
      tasks.map((task) => [task.id, task.projectId]),
    );
    if (
      locked.length !== foundIds.length ||
      locked.some((task) => task.projectId !== originalProjects.get(task.id))
    )
      throw new HTTPException(409, {
        message: "Tasks changed projects; retry the operation",
      });
    const before = await getTaskAssignees(foundIds, tx);
    if (assigneeId && assigneeMode !== "remove")
      await assertAssignableUser(
        assigneeId,
        workspaceId,
        [...new Set(locked.map((task) => task.projectId))],
        tx,
      );
    if (assigneeMode === "set") {
      await tx
        .delete(taskCoAssigneeTable)
        .where(inArray(taskCoAssigneeTable.taskId, foundIds));
      await tx
        .update(taskTable)
        .set({ userId: assigneeId })
        .where(inArray(taskTable.id, foundIds));
    } else if (assigneeMode === "add" && assigneeId) {
      if (
        locked.some(
          (task) =>
            (before.get(task.id)?.length ?? 0) >= 100 &&
            !before.get(task.id)?.some((person) => person.id === assigneeId),
        )
      )
        throw new HTTPException(400, {
          message: "A task can have at most 100 assignees",
        });
      await tx
        .update(taskTable)
        .set({
          userId: sql`coalesce((select co.user_id from task_co_assignee co where co.task_id = ${taskTable.id} order by co.created_at, co.user_id limit 1), ${assigneeId})`,
        })
        .where(and(inArray(taskTable.id, foundIds), isNull(taskTable.userId)));
      const rows = locked
        .filter(
          (task) =>
            (before.get(task.id)?.length ?? 0) > 0 &&
            !before.get(task.id)?.some((person) => person.id === assigneeId),
        )
        .map((task) => ({ taskId: task.id, userId: assigneeId }));
      for (let offset = 0; offset < rows.length; offset += 500)
        await tx
          .insert(taskCoAssigneeTable)
          .values(rows.slice(offset, offset + 500))
          .onConflictDoNothing();
    } else {
      await tx
        .update(taskTable)
        .set({
          userId: sql`(select co.user_id from task_co_assignee co where co.task_id = ${taskTable.id} and co.user_id <> ${assigneeId} order by co.created_at, co.user_id limit 1)`,
        })
        .where(
          and(
            inArray(taskTable.id, foundIds),
            eq(taskTable.userId, assigneeId!),
          ),
        );
    }
    if (assigneeMode !== "set")
      await tx
        .delete(taskCoAssigneeTable)
        .where(
          and(
            inArray(taskCoAssigneeTable.taskId, foundIds),
            or(
              assigneeMode === "remove"
                ? eq(taskCoAssigneeTable.userId, assigneeId!)
                : undefined,
              sql`exists (select 1 from task where task.id = ${taskCoAssigneeTable.taskId} and task.assignee_id = ${taskCoAssigneeTable.userId})`,
            ),
          ),
        );
    return {
      tasks: locked,
      before,
      after:
        assigneeMode === "set"
          ? new Map(
              foundIds.map((id) => [id, replacement ? [replacement] : []]),
            )
          : await getTaskAssignees(foundIds, tx),
    };
  });

  for (const task of changes.tasks) {
    await publishAssigneeChanges(
      task,
      changes.before.get(task.id) ?? [],
      changes.after.get(task.id) ?? [],
      userId,
    );
    await publishEvent("task.updated", {
      taskId: task.id,
      projectId: task.projectId,
      userId,
    });
  }

  return changes.tasks.length;
}
