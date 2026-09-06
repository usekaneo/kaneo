import {
  and,
  asc,
  eq,
  exists,
  inArray,
  isNull,
  notInArray,
  sql,
} from "drizzle-orm";
import db from "../../database";
import {
  columnTable,
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";
import { loadTaskDecorations } from "./load-task-decorations";

// Statuses the project board hides as well: planned tasks live in the backlog,
// archived ones are history. Keeping them out bounds the payload to open work.
const HIDDEN_STATUSES = ["planned", "archived"];

// The web client keeps the whole page in memory to build the merged board,
// filter and sort it, and refetches every 30 seconds, so the page size has to
// stay bounded even when the caller asks for nothing. The bound is a safety
// net well above what one person can hold open, not a working page size:
// filters and search run on the client, over the loaded page only. Tasks are
// ordered by due date, so that page is always the work due soonest.
export const MAX_ASSIGNED_TASKS = 2000;

type AssignedTasksOptions = {
  page?: number;
  limit?: number;
};

type AssignedProjectColumn = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  isFinal: boolean;
  position: number;
};

type AssignedProject = {
  id: string;
  slug: string;
  name: string;
  icon: string | null;
  position: number;
  workspaceId: string;
  workspaceName: string;
  columns: AssignedProjectColumn[];
};

/**
 * Every open task assigned to `userId` across the workspaces they belong to.
 *
 * `assignee_id = me` is not enough on its own: leaving a workspace does not
 * clear assignments, so the membership check is part of the WHERE clause, the
 * same rule `validateWorkspaceAccess` applies per request. There is no instance
 * admin bypass here: "my tasks" means the workspaces the user is a member of,
 * which is also what the workspace switcher shows.
 *
 * Paged like the project board: `page` and `limit` are optional, but unlike
 * the board there is no "everything" mode; the page size is capped.
 */
async function getAssignedTasks(
  userId: string,
  options: AssignedTasksOptions = {},
) {
  const isMember = exists(
    db
      .select({ one: sql`1` })
      .from(workspaceUserTable)
      .where(
        and(
          eq(workspaceUserTable.workspaceId, projectTable.workspaceId),
          eq(workspaceUserTable.userId, userId),
        ),
      ),
  );

  const whereClause = and(
    eq(taskTable.userId, userId),
    isNull(projectTable.archivedAt),
    notInArray(taskTable.status, HIDDEN_STATUSES),
    isMember,
  );
  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize =
    options.limit && options.limit > 0
      ? Math.min(options.limit, MAX_ASSIGNED_TASKS)
      : MAX_ASSIGNED_TASKS;
  const offset = (page - 1) * pageSize;

  const [taskCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(whereClause);
  const total = Number(taskCount?.count ?? 0);
  const pagination = {
    total,
    page,
    pageSize,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };

  const tasks = await db
    .select({
      id: taskTable.id,
      title: taskTable.title,
      number: taskTable.number,
      description: taskTable.description,
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
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(taskTable.userId, userTable.id))
    .where(whereClause)
    .orderBy(
      sql`${taskTable.dueDate} asc nulls last`,
      asc(taskTable.createdAt),
      asc(taskTable.id),
    )
    .limit(pageSize)
    .offset(offset);

  if (tasks.length === 0) {
    return {
      data: { tasks: [], projects: [] as AssignedProject[] },
      pagination,
    };
  }

  const projectIds = [...new Set(tasks.map((task) => task.projectId))];

  const [projectRows, { labelsByTask, externalLinksByTask }] =
    await Promise.all([
      db
        .select({
          id: projectTable.id,
          slug: projectTable.slug,
          name: projectTable.name,
          icon: projectTable.icon,
          position: projectTable.position,
          workspaceId: projectTable.workspaceId,
          workspaceName: workspaceTable.name,
          column: {
            id: columnTable.id,
            slug: columnTable.slug,
            name: columnTable.name,
            icon: columnTable.icon,
            isFinal: columnTable.isFinal,
            position: columnTable.position,
          },
        })
        .from(projectTable)
        .innerJoin(
          workspaceTable,
          eq(projectTable.workspaceId, workspaceTable.id),
        )
        .leftJoin(columnTable, eq(columnTable.projectId, projectTable.id))
        .where(inArray(projectTable.id, projectIds))
        // The first project to declare a column slug names the merged column on
        // the client, so ties must resolve the same way on every request.
        .orderBy(
          asc(projectTable.position),
          asc(projectTable.createdAt),
          asc(projectTable.id),
          asc(columnTable.position),
        ),
      loadTaskDecorations(tasks.map((task) => task.id)),
    ]);

  const projects = new Map<string, AssignedProject>();
  for (const row of projectRows) {
    const project = projects.get(row.id) ?? {
      id: row.id,
      slug: row.slug,
      name: row.name,
      icon: row.icon,
      position: row.position,
      workspaceId: row.workspaceId,
      workspaceName: row.workspaceName,
      columns: [],
    };
    if (row.column?.id) {
      project.columns.push({
        id: row.column.id,
        slug: row.column.slug,
        name: row.column.name,
        icon: row.column.icon,
        isFinal: row.column.isFinal,
        position: row.column.position,
      });
    }
    projects.set(row.id, project);
  }

  return {
    data: {
      tasks: tasks.map((task) => ({
        ...task,
        labels: labelsByTask.get(task.id) ?? [],
        externalLinks: externalLinksByTask.get(task.id) ?? [],
      })),
      projects: [...projects.values()],
    },
    pagination,
  };
}

export default getAssignedTasks;
