import {
  and,
  asc,
  count,
  eq,
  exists,
  ilike,
  inArray,
  not,
  notInArray,
  or,
  type SQL,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  globalBoardOrderTable,
  labelTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { escapeLikePattern } from "../../search/like-pattern";
import { TASK_SHORT_ID_PATTERN } from "../../search/task-short-id";
import type { PermissionMap } from "../../utils/role-permissions";
import { VIRTUAL_STATUSES } from "../validate-task-fields";
import { getParentTasks } from "../get-parent-tasks";
import { loadBoardScope } from "./board-scope";
import {
  type GlobalBoardFilterQuery,
  globalBoardFilterConditions,
} from "./filter-conditions";
import type { GlobalStatus } from "./global-status";

export type GlobalBoardTasksQuery = GlobalBoardFilterQuery & {
  globalStatus: GlobalStatus | "unmapped";
  q?: string;
  page: number;
  limit: number;
};

const priorityRank = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;

// A task belongs to the global status of the column its status slug names.
function inColumns(columnIds: string[]) {
  return exists(
    db
      .select({ one: sql`1` })
      .from(columnTable)
      .where(
        and(
          eq(columnTable.projectId, taskTable.projectId),
          eq(columnTable.slug, taskTable.status),
          inArray(columnTable.id, columnIds),
        ),
      ),
  );
}

function searchCondition(q: string) {
  const pattern = `%${escapeLikePattern(q)}%`;
  const ticket = q.match(TASK_SHORT_ID_PATTERN);
  return or(
    ilike(taskTable.title, pattern),
    ticket?.[1] && ticket[2]
      ? and(
          sql`lower(${projectTable.slug}) = lower(${ticket[1]})`,
          eq(taskTable.number, Number(ticket[2])),
        )
      : undefined,
  );
}

/**
 * One page of a lane's task ids, in board order. The caller's own arrangement
 * (then priority, due date, newest) decides where each project column's cards
 * sit, but the cards of one project column always fill those slots in their
 * project board order, so both boards agree on which of them comes first.
 */
async function laneOrder(
  where: SQL | undefined,
  userId: string,
  limit: number,
  offset: number,
) {
  const personalOrder = sql`${globalBoardOrderTable.position} asc nulls last, ${priorityRank} desc, ${taskTable.dueDate} asc nulls last, ${taskTable.createdAt} desc, ${taskTable.id} asc`;
  const ranked = db
    .select({
      id: sql`${taskTable.id}`.as("id"),
      projectId: sql`${taskTable.projectId}`.as("project_id"),
      status: sql`${taskTable.status}`.as("status"),
      slot: sql`row_number() over (order by ${personalOrder})`.as("slot"),
      slotInColumn:
        sql`row_number() over (partition by ${taskTable.projectId}, ${taskTable.status} order by ${personalOrder})`.as(
          "slot_in_column",
        ),
      columnRank:
        sql`row_number() over (partition by ${taskTable.projectId}, ${taskTable.status} order by ${taskTable.position} asc nulls last, ${taskTable.id} asc)`.as(
          "column_rank",
        ),
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(
      globalBoardOrderTable,
      and(
        eq(globalBoardOrderTable.taskId, taskTable.id),
        eq(globalBoardOrderTable.userId, userId),
      ),
    )
    .where(where);
  const result = await db.execute<{ id: string }>(sql`
    with ranked as (${ranked})
    select task.id
    from ranked task
    join ranked slot
      on slot.project_id = task.project_id
      and slot.status = task.status
      and slot.slot_in_column = task.column_rank
    order by slot.slot
    limit ${limit} offset ${offset}
  `);
  return result.rows.map((row) => row.id);
}

function onlyValue(
  values: string[] | undefined,
  negate: GlobalBoardFilterQuery["negate"],
  subject: "workspaceId" | "projectId",
) {
  return values?.length === 1 && !negate?.includes(subject)
    ? values[0]
    : undefined;
}

async function getGlobalBoardTasks(
  userId: string,
  apiKeyScope: PermissionMap | null,
  query: GlobalBoardTasksQuery,
) {
  const { page, limit } = query;
  // A single workspace or project narrows the scope query itself.
  const scope = await loadBoardScope(userId, apiKeyScope, {
    workspaceId: onlyValue(query.workspaceId, query.negate, "workspaceId"),
    projectId: onlyValue(query.projectId, query.negate, "projectId"),
  });
  const empty = {
    tasks: [],
    pagination: { page, pageSize: limit, total: 0, totalPages: 1 },
  };
  if (scope.projects.length === 0) return empty;

  const statusCondition =
    query.globalStatus === "unmapped"
      ? not(inColumns(Object.values(scope.columnIds).flat()))
      : inColumns(scope.columnIds[query.globalStatus]);
  const q = query.q?.trim();

  const where = and(
    inArray(
      taskTable.projectId,
      scope.projects.map((project) => project.id),
    ),
    notInArray(taskTable.status, [...VIRTUAL_STATUSES]),
    statusCondition,
    ...globalBoardFilterConditions(query, userId),
    q ? searchCondition(q) : undefined,
  );

  const [orderedIds, [totals]] = await Promise.all([
    laneOrder(where, userId, limit, (page - 1) * limit),
    db
      .select({ total: count() })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(where),
  ]);
  const details = orderedIds.length
    ? await db
        .select({
          id: taskTable.id,
          projectId: taskTable.projectId,
          number: taskTable.number,
          title: taskTable.title,
          status: taskTable.status,
          priority: taskTable.priority,
          dueDate: taskTable.dueDate,
          assigneeId: userTable.id,
          assigneeName: userTable.name,
          assigneeImage: userTable.image,
        })
        .from(taskTable)
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(inArray(taskTable.id, orderedIds))
    : [];
  const detailsById = new Map(details.map((row) => [row.id, row]));
  const rows = orderedIds.flatMap((id) => {
    const row = detailsById.get(id);
    return row ? [row] : [];
  });

  const labels = rows.length
    ? await db
        .select({
          id: labelTable.id,
          name: labelTable.name,
          color: labelTable.color,
          taskId: labelTable.taskId,
        })
        .from(labelTable)
        .where(
          inArray(
            labelTable.taskId,
            rows.map((row) => row.id),
          ),
        )
        .orderBy(asc(labelTable.name), asc(labelTable.id))
    : [];
  const labelsByTask = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const { taskId, ...label } of labels) {
    if (!taskId) continue;
    const taskLabels = labelsByTask.get(taskId) ?? [];
    taskLabels.push(label);
    labelsByTask.set(taskId, taskLabels);
  }

  const projects = new Map(
    scope.projects.map((project) => [project.id, project]),
  );
  // Parents stay within a task's workspace; look them up one workspace at a time.
  const taskIdsByWorkspace = new Map<string, string[]>();
  for (const row of rows) {
    const workspaceId = projects.get(row.projectId)?.workspaceId;
    if (!workspaceId) continue;
    taskIdsByWorkspace.set(workspaceId, [
      ...(taskIdsByWorkspace.get(workspaceId) ?? []),
      row.id,
    ]);
  }
  const parentTasks = new Map(
    (
      await Promise.all(
        [...taskIdsByWorkspace].map(([workspaceId, taskIds]) =>
          getParentTasks(db, taskIds, workspaceId, false, userId),
        ),
      )
    ).flatMap((parents) => [...parents]),
  );
  const workspaces = new Map(
    scope.workspaces.map((workspace) => [workspace.id, workspace]),
  );
  const total = Number(totals?.total ?? 0);

  return {
    tasks: rows.flatMap(
      ({ assigneeId, assigneeName, assigneeImage, ...task }) => {
        const project = projects.get(task.projectId);
        const workspace = project && workspaces.get(project.workspaceId);
        if (!project || !workspace) return [];
        const column = project.columns.find(
          (candidate) => candidate.slug === task.status,
        );
        return [
          {
            ...task,
            statusName: column?.name ?? null,
            statusIcon: column?.icon ?? null,
            projectName: project.name,
            projectSlug: project.slug,
            projectIcon: project.icon,
            workspaceId: workspace.id,
            workspaceName: workspace.name,
            assignee: assigneeId
              ? {
                  id: assigneeId,
                  name: assigneeName ?? "",
                  image: assigneeImage,
                }
              : null,
            parentTask: parentTasks.get(task.id) ?? null,
            labels: labelsByTask.get(task.id) ?? [],
          },
        ];
      },
    ),
    pagination: {
      page,
      pageSize: limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}

export default getGlobalBoardTasks;
