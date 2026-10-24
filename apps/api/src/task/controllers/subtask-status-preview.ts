import { and, asc, eq, inArray, ne, not, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";

import {
  columnTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { boundedTaskRead, type TaskReadDatabase } from "../bounded-read";
import { taskIsCompleted } from "../task-is-completed";

export async function subtaskStatusPreview(
  tx: TaskReadDatabase,
  id: string,
  status: string,
  userId: string,
  workspaceId: string,
) {
  const [parent] = await tx
    .select({
      id: taskTable.id,
      title: taskTable.title,
      projectId: taskTable.projectId,
      status: taskTable.status,
      userId: taskTable.userId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskTable.id, id),
        eq(projectTable.workspaceId, workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    );
  if (!parent) throw new HTTPException(404, { message: "Task not found" });
  if (parent.status !== status)
    throw new HTTPException(409, {
      message: "Parent status changed; refresh before updating subtasks",
    });
  const column = await tx.query.columnTable.findFirst({
    where: and(
      eq(columnTable.projectId, parent.projectId),
      eq(columnTable.slug, status),
    ),
  });
  const result = {
    parent,
    parentTitle: parent.title,
    status,
    statusName: column?.name ?? status,
    subtasks: [] as Array<{
      id: string;
      title: string;
      projectId: string;
      status: string;
      assigneeName: string | null;
      destinationStatus: string | null;
    }>,
  };
  if (status !== "archived" && !column?.isFinal) return result;

  // UNION (rather than UNION ALL) terminates legacy cycles and deduplicates
  // descendants with multiple paths. Access is checked at every step.
  const descendantIds = sql`with recursive descendants(id) as (
    select ${id}::text
    union
    select child.id from descendants d
    join task_relation relation on relation.source_task_id = d.id and relation.relation_type = 'subtask'
    join task child on child.id = relation.target_task_id
    join project child_project on child_project.id = child.project_id
    where child_project.workspace_id = ${workspaceId}
      and ${projectAccessCondition(userId, sql`child_project.id`)}
  ) select id from descendants`;
  const children = await tx
    .select({
      id: taskTable.id,
      title: taskTable.title,
      projectId: taskTable.projectId,
      status: taskTable.status,
      assigneeName: userTable.name,
    })
    .from(taskTable)
    .leftJoin(userTable, eq(userTable.id, taskTable.userId))
    .where(
      and(
        sql`${taskTable.id} in (${descendantIds})`,
        ne(taskTable.id, id),
        ne(taskTable.status, "archived"),
        not(taskIsCompleted),
      ),
    )
    .orderBy(asc(taskTable.id))
    .limit(1001);
  if (children.length > 1000)
    throw new HTTPException(400, {
      message: "Too many open subtasks; update them in smaller groups",
    });
  const projectIds = [...new Set(children.map((child) => child.projectId))];
  const finals = projectIds.length
    ? await tx
        .select()
        .from(columnTable)
        .where(
          and(
            inArray(columnTable.projectId, projectIds),
            eq(columnTable.isFinal, true),
          ),
        )
        .orderBy(asc(columnTable.position), asc(columnTable.id))
    : [];
  result.subtasks = children.map((child) => ({
    ...child,
    destinationStatus:
      status === "archived"
        ? "archived"
        : ((
            finals.find(
              (final) =>
                final.projectId === child.projectId && final.slug === status,
            ) ?? finals.find((final) => final.projectId === child.projectId)
          )?.slug ?? null),
  }));
  return result;
}

export default async function getSubtaskStatusPreview(
  id: string,
  status: string,
  userId: string,
  workspaceId: string,
) {
  return boundedTaskRead(async (tx) => {
    const { parent: _parent, ...preview } = await subtaskStatusPreview(
      tx,
      id,
      status,
      userId,
      workspaceId,
    );
    return preview;
  }, "Subtask preview took too long; retry later");
}
