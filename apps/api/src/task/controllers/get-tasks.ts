import {
  and,
  asc,
  desc,
  eq,
  getTableColumns,
  gte,
  inArray,
  lte,
  type SQL,
  type SQLWrapper,
  sql,
} from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { HTTPException } from "hono/http-exception";
import {
  columnTable,
  externalLinkTable,
  labelTable,
  projectTable,
  taskTable,
  taskRelationTable,
  userTable,
} from "../../database/schema";
import { boundedTaskRead, type TaskReadDatabase } from "../bounded-read";
import {
  boardDescription,
  boardProjectDescription,
  descriptionDeferred,
  projectDescriptionDeferred,
} from "../description-pages";
import { taskIsCompleted } from "../task-is-completed";
import { getSubtaskCounts } from "../get-subtask-counts";

export type GetTasksOptions = {
  publicOnly?: boolean;
  assigneeId?: string;
  dueAfter?: string;
  dueBefore?: string;
  limit?: number;
  page?: number;
  relatedPage?: number;
  priority?: string;
  sortBy?:
    | "createdAt"
    | "priority"
    | "dueDate"
    | "position"
    | "title"
    | "number";
  sortOrder?: "asc" | "desc";
  status?: string;
};

const priorityCaseExpr = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;

function sortValue(sortBy: GetTasksOptions["sortBy"]): SQLWrapper {
  switch (sortBy) {
    case "createdAt":
      return taskTable.createdAt;
    case "priority":
      return priorityCaseExpr;
    case "dueDate":
      return taskTable.dueDate;
    case "title":
      return taskTable.title;
    case "number":
      return taskTable.number;
    default:
      return taskTable.position;
  }
}
function buildOrderBy(
  sortBy: GetTasksOptions["sortBy"],
  sortOrder: GetTasksOptions["sortOrder"],
): SQL {
  return (sortOrder === "desc" ? desc : asc)(sortValue(sortBy));
}

function boardRevision(
  publicOnly: boolean | undefined,
  fields: SQLWrapper[],
): SQL<string> {
  return publicOnly
    ? sql<string>`coalesce(sum(hashtextextended(jsonb_build_array(${sql.join(fields, sql`, `)})::text, 0)::numeric), 0)::text`
    : sql<string>`'0'`;
}

async function getTasksPage(
  db: TaskReadDatabase,
  projectId: string,
  options: GetTasksOptions,
  userId?: string,
) {
  const [project] = await db
    .select({
      ...getTableColumns(projectTable),
      revision: options.publicOnly
        ? sql<string>`${projectTable}.xmin::text`
        : sql<string>`'0'`,
      description: boardProjectDescription,
      descriptionDeferred: projectDescriptionDeferred,
    })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (!project) {
    throw new HTTPException(404, {
      message: "Project not found",
    });
  }

  const conditions = [eq(taskTable.projectId, projectId)];

  if (options.status) {
    conditions.push(eq(taskTable.status, options.status));
  }

  if (options.priority) {
    conditions.push(eq(taskTable.priority, options.priority));
  }

  if (options.assigneeId) {
    conditions.push(eq(taskTable.userId, options.assigneeId));
  }

  if (options.dueBefore) {
    conditions.push(lte(taskTable.dueDate, new Date(options.dueBefore)));
  }

  if (options.dueAfter) {
    conditions.push(gte(taskTable.dueDate, new Date(options.dueAfter)));
  }

  const whereClause = and(...conditions);
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize =
    options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
  const offset = (page - 1) * pageSize;
  const relatedPage = options.relatedPage ?? 1;
  const relatedPageSize = 100;
  const relatedOffset = (relatedPage - 1) * relatedPageSize;

  const orderByClause = buildOrderBy(
    options.sortBy ?? "position",
    options.sortOrder ?? "asc",
  );

  const taskCountQuery = db
    .select({
      count: sql<number>`count(*)`,
      revision: boardRevision(options.publicOnly, [
        taskTable.id,
        sortValue(options.sortBy),
        taskTable.status,
        // Row versions detect content edits without hashing large descriptions.
        sql`${taskTable}.xmin::text`,
        userTable.name,
        userTable.image,
      ]),
    })
    .from(taskTable)
    .$dynamic();
  const [taskCount] = await (
    options.publicOnly
      ? taskCountQuery.leftJoin(userTable, eq(taskTable.userId, userTable.id))
      : taskCountQuery
  ).where(whereClause);

  const total = Number(taskCount?.count ?? 0);

  const taskSelection = {
    id: taskTable.id,
    title: taskTable.title,
    number: taskTable.number,
    description: boardDescription,
    descriptionDeferred,
    status: taskTable.status,
    priority: taskTable.priority,
    startDate: taskTable.startDate,
    dueDate: taskTable.dueDate,
    position: taskTable.position,
    createdAt: taskTable.createdAt,
    userId: taskTable.userId,
    assigneeName: userTable.name,
    assigneeId: userTable.id,
    assigneeImage: userTable.image,
    projectId: taskTable.projectId,
  };

  const query = db
    .select(taskSelection)
    .from(taskTable)
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(whereClause)
    .orderBy(orderByClause, asc(taskTable.id));

  const paginatedTasks = await query.limit(pageSize).offset(offset);

  const taskIds = paginatedTasks.map((task) => task.id);

  const subtaskCounts = await getSubtaskCounts(
    db,
    taskIds,
    project.workspaceId,
    options.publicOnly ?? false,
    userId,
  );

  const labelsData =
    taskIds.length > 0
      ? await db
          .select({
            id: labelTable.id,
            name: labelTable.name,
            color: labelTable.color,
            taskId: labelTable.taskId,
          })
          .from(labelTable)
          .where(inArray(labelTable.taskId, taskIds))
          .orderBy(asc(labelTable.id))
          .limit(relatedPageSize)
          .offset(relatedOffset)
      : [];

  const externalLinksData =
    taskIds.length > 0
      ? await db
          .select()
          .from(externalLinkTable)
          .where(inArray(externalLinkTable.taskId, taskIds))
          .orderBy(asc(externalLinkTable.id))
          .limit(relatedPageSize)
          .offset(relatedOffset)
      : [];

  const taskLabelsMap = new Map<
    string,
    Array<{ id: string; name: string; color: string }>
  >();
  for (const label of labelsData) {
    if (label.taskId) {
      if (!taskLabelsMap.has(label.taskId)) {
        taskLabelsMap.set(label.taskId, []);
      }
      taskLabelsMap.get(label.taskId)?.push({
        id: label.id,
        name: label.name,
        color: label.color,
      });
    }
  }

  const taskExternalLinksMap = new Map<
    string,
    Array<{
      id: string;
      taskId: string;
      integrationId: string | null;
      resourceType: string;
      externalId: string;
      url: string;
      title: string | null;
      metadata: Record<string, unknown> | null;
      createdAt: Date;
      updatedAt: Date;
    }>
  >();
  for (const externalLink of externalLinksData) {
    if (!taskExternalLinksMap.has(externalLink.taskId)) {
      taskExternalLinksMap.set(externalLink.taskId, []);
    }
    taskExternalLinksMap.get(externalLink.taskId)?.push({
      ...externalLink,
      metadata: parseMetadata(externalLink.metadata),
    });
  }

  const projectColumns = await db
    .select()
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId))
    .orderBy(asc(columnTable.position), asc(columnTable.id))
    .limit(relatedPageSize)
    .offset(relatedOffset);

  // Keep every selected task representable even when its column falls on a
  // later metadata page. At most 100 distinct task statuses can be present.
  const missingStatuses = Array.from(
    new Set(paginatedTasks.map((task) => task.status)),
  ).filter(
    (status) =>
      status !== "planned" &&
      status !== "archived" &&
      !projectColumns.some((column) => column.slug === status),
  );
  if (missingStatuses.length) {
    const taskColumns = await db
      .selectDistinctOn([columnTable.slug])
      .from(columnTable)
      .where(
        and(
          eq(columnTable.projectId, projectId),
          inArray(columnTable.slug, missingStatuses),
        ),
      )
      .orderBy(
        asc(columnTable.slug),
        asc(columnTable.position),
        asc(columnTable.id),
      )
      .limit(100);
    projectColumns.push(...taskColumns);
  }
  const [columnCount] = await db
    .select({
      count: sql<number>`count(*)`,
      revision: boardRevision(options.publicOnly, [
        columnTable.id,
        columnTable.slug,
        columnTable.position,
        columnTable.name,
        columnTable.icon,
        columnTable.isFinal,
      ]),
    })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId));
  let labelCount = 0;
  let linkCount = 0;
  let labelRevision = "0";
  let linkRevision = "0";
  if (taskIds.length) {
    const [labels] = await db
      .select({
        count: sql<number>`count(*)`,
        revision: boardRevision(options.publicOnly, [
          labelTable.id,
          labelTable.taskId,
          labelTable.name,
          labelTable.color,
        ]),
      })
      .from(labelTable)
      .where(inArray(labelTable.taskId, taskIds));
    const [links] = await db
      .select({
        count: sql<number>`count(*)`,
        revision: boardRevision(options.publicOnly, [
          externalLinkTable.id,
          externalLinkTable.taskId,
          sql`${externalLinkTable}.xmin::text`,
        ]),
      })
      .from(externalLinkTable)
      .where(inArray(externalLinkTable.taskId, taskIds));
    labelCount = Number(labels?.count ?? 0);
    linkCount = Number(links?.count ?? 0);
    labelRevision = labels?.revision ?? "0";
    linkRevision = links?.revision ?? "0";
  }

  let publicRelatedRevision = "0";
  if (options.publicOnly) {
    // Every task page must detect edits to cards or metadata loaded earlier.
    const [labels] = await db
      .select({
        revision: boardRevision(true, [
          labelTable.id,
          labelTable.taskId,
          labelTable.name,
          labelTable.color,
        ]),
      })
      .from(labelTable)
      .innerJoin(taskTable, eq(labelTable.taskId, taskTable.id))
      .where(whereClause);
    const [links] = await db
      .select({
        revision: boardRevision(true, [
          externalLinkTable.id,
          sql`${externalLinkTable}.xmin::text`,
        ]),
      })
      .from(externalLinkTable)
      .innerJoin(taskTable, eq(externalLinkTable.taskId, taskTable.id))
      .where(whereClause);
    const parent = alias(taskTable, "board_parent");
    const [children] = await db
      .select({
        revision: boardRevision(true, [
          taskRelationTable.id,
          taskTable.id,
          taskIsCompleted,
        ]),
      })
      .from(taskRelationTable)
      .innerJoin(parent, eq(taskRelationTable.sourceTaskId, parent.id))
      .innerJoin(taskTable, eq(taskRelationTable.targetTaskId, taskTable.id))
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .where(
        and(
          eq(parent.projectId, projectId),
          eq(taskRelationTable.relationType, "subtask"),
          eq(projectTable.workspaceId, project.workspaceId),
          eq(projectTable.isPublic, true),
        ),
      );
    publicRelatedRevision = `${labels?.revision}:${links?.revision}:${children?.revision}`;
  }

  const columns = projectColumns.map((column) => ({
    id: column.slug,
    slug: column.slug,
    name: column.name,
    position: column.position,
    icon: column.icon,
    isFinal: column.isFinal,
    tasks: paginatedTasks
      .filter((task) => task.status === column.slug)
      .map((task) => ({
        ...task,
        subtaskCounts: subtaskCounts.get(task.id) ?? { completed: 0, total: 0 },
        labels: taskLabelsMap.get(task.id) || [],
        externalLinks: taskExternalLinksMap.get(task.id) || [],
      })),
  }));

  const archivedTasks = paginatedTasks
    .filter((task) => task.status === "archived")
    .map((task) => ({
      ...task,
      subtaskCounts: subtaskCounts.get(task.id) ?? { completed: 0, total: 0 },
      labels: taskLabelsMap.get(task.id) || [],
      externalLinks: taskExternalLinksMap.get(task.id) || [],
    }));

  const plannedTasks = paginatedTasks
    .filter((task) => task.status === "planned")
    .map((task) => ({
      ...task,
      subtaskCounts: subtaskCounts.get(task.id) ?? { completed: 0, total: 0 },
      labels: taskLabelsMap.get(task.id) || [],
      externalLinks: taskExternalLinksMap.get(task.id) || [],
    }));

  return {
    data: {
      id: project.id,
      name: project.name,
      slug: project.slug,
      icon: project.icon,
      description: project.description,
      descriptionDeferred: project.descriptionDeferred,
      isPublic: project.isPublic,
      workspaceId: project.workspaceId,
      backgroundVersion: project.backgroundVersion,
      columns,
      archivedTasks,
      plannedTasks,
    },
    pagination: {
      total,
      ...(options.publicOnly
        ? {
            revision: `${project.revision}:${total}:${taskCount?.revision}:${columnCount?.count}:${columnCount?.revision}:${publicRelatedRevision}`,
            relatedRevision: `${labelCount}:${labelRevision}:${linkCount}:${linkRevision}`,
          }
        : {}),
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
      relatedPage,
      relatedPageSize,
      relatedTotalPages: Math.max(
        1,
        Math.ceil(
          Math.max(Number(columnCount?.count ?? 0), labelCount, linkCount) /
            relatedPageSize,
        ),
      ),
    },
  };
}

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export default function getTasks(
  projectId: string,
  options: GetTasksOptions = {},
  userId?: string,
) {
  return boundedTaskRead(
    (db) => getTasksPage(db, projectId, options, userId),
    "Task list request took too long; retry later",
  );
}
