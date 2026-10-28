import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import {
  columnTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { validateAndParseDate } from "../../utils/validate-dates";
import { boundedTaskRead, type TaskReadDatabase } from "../bounded-read";
import { boardDescription, descriptionDeferred } from "../description-pages";
import { priorityRank } from "../priority-rank";
import { loadTaskDecorations } from "../workspace-board/load-task-decorations";
import { mergeColumns } from "../workspace-board/merge-columns";
import { workspaceBoardTaskConditions } from "../workspace-board/task-conditions";

export type WorkspaceBoardOptions = {
  projectIds?: string[];
  assigneeIds?: string[];
  status?: string[];
  priority?: string[];
  labelIds?: string[];
  dueBefore?: string;
  dueAfter?: string;
  includeCompleted?: boolean;
  page?: number;
  limit?: number;
};

export const WORKSPACE_BOARD_ID_PREFIX = "workspace-board:";

async function getWorkspaceBoardPage(
  db: TaskReadDatabase,
  workspaceId: string,
  userId: string,
  options: WorkspaceBoardOptions,
) {
  const dueBefore = options.dueBefore
    ? validateAndParseDate(options.dueBefore, "dueBefore")
    : undefined;
  const dueAfter = options.dueAfter
    ? validateAndParseDate(options.dueAfter, "dueAfter")
    : undefined;

  const projects = await db
    .select({
      id: projectTable.id,
      name: projectTable.name,
      slug: projectTable.slug,
      icon: projectTable.icon,
    })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .orderBy(asc(projectTable.name), asc(projectTable.id));

  const accessibleProjectIds = projects.map((project) => project.id);
  // Requested projects outside the accessible set are silently dropped so the
  // response never reveals that they exist.
  const scopedProjectIds = options.projectIds?.length
    ? accessibleProjectIds.filter((id) => options.projectIds?.includes(id))
    : accessibleProjectIds;

  const columns = accessibleProjectIds.length
    ? await db
        .select()
        .from(columnTable)
        .where(inArray(columnTable.projectId, accessibleProjectIds))
        .orderBy(
          asc(columnTable.position),
          asc(columnTable.createdAt),
          asc(columnTable.id),
        )
    : [];

  const columnSlugsByProject = new Map<string, Set<string>>();
  const finalSlugsByProject = new Map<string, Set<string>>();
  for (const column of columns) {
    const slugs = columnSlugsByProject.get(column.projectId) ?? new Set();
    slugs.add(column.slug);
    columnSlugsByProject.set(column.projectId, slugs);
    if (column.isFinal) {
      const finals = finalSlugsByProject.get(column.projectId) ?? new Set();
      finals.add(column.slug);
      finalSlugsByProject.set(column.projectId, finals);
    }
  }

  const page = options.page && options.page > 0 ? options.page : 1;
  const pageSize =
    options.limit && options.limit > 0 ? Math.min(options.limit, 100) : 50;
  const offset = (page - 1) * pageSize;

  const selectTasks = async () => {
    if (!scopedProjectIds.length) {
      return { total: 0, tasks: [] };
    }
    const whereClause = workspaceBoardTaskConditions(
      workspaceId,
      scopedProjectIds,
      { ...options, dueBefore, dueAfter },
    );

    // One transaction holds one connection, so its queries run one at a time.
    const [totals] = await db
      .select({ total: sql<number>`count(*)` })
      .from(taskTable)
      .where(whereClause);
    const tasks = await db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        number: taskTable.number,
        description: boardDescription,
        descriptionDeferred,
        status: taskTable.status,
        priority: taskTable.priority,
        startDate: taskTable.startDate,
        dueDate: taskTable.dueDate,
        recurrence: taskTable.recurrence,
        position: taskTable.position,
        createdAt: taskTable.createdAt,
        userId: taskTable.userId,
        assigneeName: userTable.name,
        assigneeId: userTable.id,
        assigneeImage: userTable.image,
        projectId: taskTable.projectId,
        projectSlug: projectTable.slug,
        projectName: projectTable.name,
        projectIcon: projectTable.icon,
        workspaceId: projectTable.workspaceId,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(whereClause)
      .orderBy(
        sql`${taskTable.dueDate} asc nulls last`,
        desc(priorityRank),
        asc(taskTable.position),
        asc(taskTable.createdAt),
        asc(taskTable.id),
      )
      .limit(pageSize)
      .offset(offset);
    return { total: Number(totals?.total ?? 0), tasks };
  };

  const { total, tasks } = await selectTasks();

  const decorations = await loadTaskDecorations(
    db,
    tasks.map((task) => task.id),
    workspaceId,
    userId,
  );
  const decorate = (task: (typeof tasks)[number]) => ({
    ...task,
    ...decorations(task.id),
  });

  // Lanes follow the projects in scope; the per-project slugs below still
  // cover every accessible project.
  const scoped = new Set(scopedProjectIds);
  const mergedColumns = mergeColumns(
    columns.filter((column) => scoped.has(column.projectId)),
    tasks.map((task) => task.status),
  );

  return {
    data: {
      id: `${WORKSPACE_BOARD_ID_PREFIX}${workspaceId}`,
      name: "Workspace tasks",
      slug: "",
      icon: null,
      description: null,
      isPublic: false,
      workspaceId,
      backgroundVersion: null,
      columns: mergedColumns.map((column, index) => ({
        id: column.slug,
        slug: column.slug,
        name: column.name,
        icon: column.icon,
        isFinal: column.isFinal,
        position: index,
        tasks: tasks
          .filter((task) => task.status === column.slug)
          .map(decorate),
      })),
      archivedTasks: [],
      plannedTasks: [],
      projects: projects.map((project) => ({
        ...project,
        columnSlugs: [...(columnSlugsByProject.get(project.id) ?? [])],
        finalColumnSlugs: [...(finalSlugsByProject.get(project.id) ?? [])],
      })),
    },
    pagination: {
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  };
}

export default function getWorkspaceBoard(
  workspaceId: string,
  userId: string,
  options: WorkspaceBoardOptions = {},
) {
  if (!userId) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }
  return boundedTaskRead(
    (db) => getWorkspaceBoardPage(db, workspaceId, userId, options),
    "Workspace board request took too long; retry later",
  );
}
