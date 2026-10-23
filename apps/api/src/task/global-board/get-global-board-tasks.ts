import {
  and,
  asc,
  count,
  desc,
  eq,
  exists,
  ilike,
  inArray,
  not,
  notInArray,
  or,
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

  const [rows, [totals]] = await Promise.all([
    db
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
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .leftJoin(
        globalBoardOrderTable,
        and(
          eq(globalBoardOrderTable.taskId, taskTable.id),
          eq(globalBoardOrderTable.userId, userId),
        ),
      )
      .where(where)
      .orderBy(
        // The caller's own arrangement first; unplaced tasks follow by priority.
        sql`${globalBoardOrderTable.position} asc nulls last`,
        desc(priorityRank),
        sql`${taskTable.dueDate} asc nulls last`,
        desc(taskTable.createdAt),
        asc(taskTable.id),
      )
      .limit(limit)
      .offset((page - 1) * limit),
    db
      .select({ total: count() })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(where),
  ]);

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
