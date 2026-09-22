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
  sql,
} from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  columnTable,
  externalLinkTable,
  labelTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";

import { boundedTaskRead, type TaskReadDatabase } from "../bounded-read";
import {
  boardDescription,
  boardProjectDescription,
  descriptionDeferred,
  projectDescriptionDeferred,
} from "../description-pages";

export type GetTasksOptions = {
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

function buildOrderBy(
  sortBy: GetTasksOptions["sortBy"],
  sortOrder: GetTasksOptions["sortOrder"],
): SQL {
  const direction = sortOrder === "desc" ? desc : asc;

  switch (sortBy) {
    case "createdAt":
      return direction(taskTable.createdAt);
    case "priority":
      return direction(priorityCaseExpr);
    case "dueDate":
      return direction(taskTable.dueDate);
    case "title":
      return direction(taskTable.title);
    case "number":
      return direction(taskTable.number);
    default:
      return direction(taskTable.position);
  }
}

async function getTasksPage(
  db: TaskReadDatabase,
  projectId: string,
  options: GetTasksOptions,
) {
  const [project] = await db
    .select({
      ...getTableColumns(projectTable),
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

  const [taskCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(taskTable)
    .where(whereClause);

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
      integrationId: string;
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
    .select({ count: sql<number>`count(*)` })
    .from(columnTable)
    .where(eq(columnTable.projectId, projectId));
  let labelCount = 0;
  let linkCount = 0;
  if (taskIds.length) {
    const [labels] = await db
      .select({ count: sql<number>`count(*)` })
      .from(labelTable)
      .where(inArray(labelTable.taskId, taskIds));
    const [links] = await db
      .select({ count: sql<number>`count(*)` })
      .from(externalLinkTable)
      .where(inArray(externalLinkTable.taskId, taskIds));
    labelCount = Number(labels?.count ?? 0);
    linkCount = Number(links?.count ?? 0);
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
        labels: taskLabelsMap.get(task.id) || [],
        externalLinks: taskExternalLinksMap.get(task.id) || [],
      })),
  }));

  const archivedTasks = paginatedTasks
    .filter((task) => task.status === "archived")
    .map((task) => ({
      ...task,
      labels: taskLabelsMap.get(task.id) || [],
      externalLinks: taskExternalLinksMap.get(task.id) || [],
    }));

  const plannedTasks = paginatedTasks
    .filter((task) => task.status === "planned")
    .map((task) => ({
      ...task,
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
      columns,
      archivedTasks,
      plannedTasks,
    },
    pagination: {
      total,
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
) {
  return boundedTaskRead(
    (db) => getTasksPage(db, projectId, options),
    "Task list request took too long; retry later",
  );
}
