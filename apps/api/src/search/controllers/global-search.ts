import { and, desc, eq, ilike, or, sql } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  projectTable,
  taskTable,
  userTable,
  workspaceTable,
  workspaceUserTable,
} from "../../database/schema";

type SearchParams = {
  query: string;
  userEmail?: string;
  userId?: string;
  type?:
    | "all"
    | "tasks"
    | "projects"
    | "workspaces"
    | "comments"
    | "activities";
  workspaceId?: string;
  projectId?: string;
  limit?: number;
};

type SearchResult = {
  id: string;
  type: "task" | "project" | "workspace" | "comment" | "activity";
  title: string;
  description?: string;
  content?: string;
  projectId?: string;
  projectName?: string;
  workspaceId?: string;
  workspaceName?: string;
  userId?: string;
  userName?: string;
  createdAt: Date;
  relevanceScore: number;
  taskNumber?: number;
  projectSlug?: string;
  priority?: string;
  status?: string;
};

function toDisplayCase(value: string) {
  return value
    .replace(/[-_]/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function getActivitySearchContent(
  type: string,
  content: string | null,
  eventData: unknown,
) {
  if (content) return content;
  if (!eventData || typeof eventData !== "object" || Array.isArray(eventData)) {
    return undefined;
  }

  const data = eventData as Record<string, unknown>;

  switch (type) {
    case "status_changed":
      return `changed status from ${toDisplayCase(String(data.oldStatus ?? ""))} to ${toDisplayCase(String(data.newStatus ?? ""))}`;
    case "priority_changed":
      return `changed priority from ${toDisplayCase(String(data.oldPriority ?? ""))} to ${toDisplayCase(String(data.newPriority ?? ""))}`;
    case "unassigned":
      return "unassigned the task";
    case "assignee_changed":
      return data.isSelfAssigned
        ? "assigned the task to themselves"
        : `assigned the task to ${String(data.newAssignee ?? "someone")}`;
    case "due_date_changed":
      if (!data.newDueDate) {
        return "cleared the due date";
      }
      if (!data.oldDueDate) {
        return `set due date to ${String(data.newDueDate)}`;
      }
      return `changed due date from ${String(data.oldDueDate)} to ${String(data.newDueDate)}`;
    case "title_changed":
      return `changed title from "${String(data.oldTitle ?? "")}" to "${String(data.newTitle ?? "")}"`;
    default:
      return undefined;
  }
}

async function globalSearch(params: SearchParams): Promise<{
  results: SearchResult[];
  totalCount: number;
  searchQuery: string;
}> {
  const {
    query,
    userId,
    userEmail,
    type = "all",
    workspaceId,
    projectId,
    limit = 20,
  } = params;

  let resolvedUserId = userId;
  if (!resolvedUserId && userEmail) {
    const user = await db
      .select({ id: userTable.id })
      .from(userTable)
      .where(eq(userTable.email, userEmail))
      .limit(1);

    if (user.length > 0 && user[0]) {
      resolvedUserId = user[0].id;
    }
  }

  if (!resolvedUserId) {
    return { results: [], totalCount: 0, searchQuery: query };
  }

  const userWorkspaces = await db
    .select({ workspaceId: workspaceUserTable.workspaceId })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.userId, resolvedUserId));

  const accessibleWorkspaceIds = userWorkspaces
    .map((w) => w.workspaceId)
    .filter(Boolean);

  if (accessibleWorkspaceIds.length === 0) {
    return { results: [], totalCount: 0, searchQuery: query };
  }

  const results: SearchResult[] = [];
  const searchPattern = `%${query.toLowerCase()}%`;

  const workspaceFilter = workspaceId
    ? eq(projectTable.workspaceId, workspaceId)
    : sql`${projectTable.workspaceId} IN ${accessibleWorkspaceIds}`;

  // Check if query matches short-id pattern (e.g. "DEP-23")
  const shortIdMatch = query.match(/^([A-Za-z][\w-]*)-(\d+)$/);

  if (type === "all" || type === "tasks") {
    const seenTaskIds = new Set<string>();

    // If query matches short-id pattern, look up by project slug + task number first
    if (shortIdMatch) {
      const slug = shortIdMatch[1];
      const numberStr = shortIdMatch[2];
      if (!slug || !numberStr) {
        return { results: [], totalCount: 0, searchQuery: query };
      }
      const taskNumber = Number.parseInt(numberStr, 10);

      const shortIdTasks = await db
        .select({
          id: taskTable.id,
          title: taskTable.title,
          description: taskTable.description,
          projectId: taskTable.projectId,
          projectName: projectTable.name,
          projectSlug: projectTable.slug,
          workspaceId: projectTable.workspaceId,
          workspaceName: workspaceTable.name,
          userId: taskTable.userId,
          userName: userTable.name,
          createdAt: taskTable.createdAt,
          taskNumber: taskTable.number,
          priority: taskTable.priority,
          status: taskTable.status,
        })
        .from(taskTable)
        .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(
          workspaceTable,
          eq(projectTable.workspaceId, workspaceTable.id),
        )
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(
          and(
            workspaceFilter,
            projectId ? eq(taskTable.projectId, projectId) : undefined,
            ilike(projectTable.slug, slug),
            eq(taskTable.number, taskNumber),
          ),
        )
        .limit(1);

      for (const task of shortIdTasks) {
        seenTaskIds.add(task.id);
        results.push({
          id: task.id,
          type: "task",
          title: task.title,
          description: task.description || undefined,
          projectId: task.projectId,
          projectName: task.projectName || undefined,
          projectSlug: task.projectSlug || undefined,
          workspaceId: task.workspaceId || undefined,
          workspaceName: task.workspaceName || undefined,
          userId: task.userId || undefined,
          userName: task.userName || undefined,
          createdAt: task.createdAt,
          relevanceScore: 10, // Highest relevance for exact short-id match
          taskNumber: task.taskNumber || undefined,
          priority: task.priority || undefined,
          status: task.status,
        });
      }
    }

    // Also run text search for tasks
    const taskRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${taskTable.title}) LIKE ${searchPattern} THEN 3
        WHEN LOWER(${taskTable.description}) LIKE ${searchPattern} THEN 2
        ELSE 1
      END
    `;

    const taskQuery = db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        description: taskTable.description,
        projectId: taskTable.projectId,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        userId: taskTable.userId,
        userName: userTable.name,
        createdAt: taskTable.createdAt,
        taskNumber: taskTable.number,
        priority: taskTable.priority,
        status: taskTable.status,
        relevanceScore: taskRelevanceScore.as("relevanceScore"),
      })
      .from(taskTable)
      .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(
        and(
          workspaceFilter,
          projectId ? eq(taskTable.projectId, projectId) : undefined,
          or(
            ilike(taskTable.title, searchPattern),
            ilike(taskTable.description, searchPattern),
          ),
        ),
      )
      .orderBy(desc(taskRelevanceScore), desc(taskTable.createdAt))
      .limit(limit);

    const tasks = await taskQuery;

    for (const task of tasks) {
      if (seenTaskIds.has(task.id)) continue;
      results.push({
        id: task.id,
        type: "task",
        title: task.title,
        description: task.description || undefined,
        projectId: task.projectId,
        projectName: task.projectName || undefined,
        projectSlug: task.projectSlug || undefined,
        workspaceId: task.workspaceId || undefined,
        workspaceName: task.workspaceName || undefined,
        userId: task.userId || undefined,
        userName: task.userName || undefined,
        createdAt: task.createdAt,
        relevanceScore: task.relevanceScore,
        taskNumber: task.taskNumber || undefined,
        priority: task.priority || undefined,
        status: task.status,
      });
    }
  }

  if (type === "all" || type === "projects") {
    const projectRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${projectTable.name}) LIKE ${searchPattern} THEN 3
        WHEN LOWER(${projectTable.description}) LIKE ${searchPattern} THEN 2
        ELSE 1
      END
    `;

    const projectQuery = db
      .select({
        id: projectTable.id,
        name: projectTable.name,
        description: projectTable.description,
        slug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        createdAt: projectTable.createdAt,
        relevanceScore: projectRelevanceScore.as("relevanceScore"),
      })
      .from(projectTable)
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .where(
        and(
          workspaceFilter,
          or(
            ilike(projectTable.name, searchPattern),
            ilike(projectTable.description, searchPattern),
          ),
        ),
      )
      .orderBy(desc(projectRelevanceScore), desc(projectTable.createdAt))
      .limit(limit);

    const projects = await projectQuery;

    for (const project of projects) {
      results.push({
        id: project.id,
        type: "project",
        title: project.name,
        description: project.description || undefined,
        projectId: project.id,
        projectSlug: project.slug || undefined,
        workspaceId: project.workspaceId,
        workspaceName: project.workspaceName || undefined,
        createdAt: project.createdAt,
        relevanceScore: project.relevanceScore,
      });
    }
  }

  if (type === "all" || type === "workspaces") {
    const workspaceRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${workspaceTable.name}) LIKE ${searchPattern} THEN 3
        WHEN LOWER(${workspaceTable.description}) LIKE ${searchPattern} THEN 2
        ELSE 1
      END
    `;

    const workspaceQuery = db
      .select({
        id: workspaceTable.id,
        name: workspaceTable.name,
        description: workspaceTable.description,
        createdAt: workspaceTable.createdAt,
        relevanceScore: workspaceRelevanceScore.as("relevanceScore"),
      })
      .from(workspaceTable)
      .leftJoin(
        workspaceUserTable,
        eq(workspaceTable.id, workspaceUserTable.workspaceId),
      )
      .where(
        and(
          sql`${workspaceTable.id} IN ${accessibleWorkspaceIds}`,
          or(
            ilike(workspaceTable.name, searchPattern),
            ilike(workspaceTable.description, searchPattern),
          ),
        ),
      )
      .orderBy(desc(workspaceRelevanceScore), desc(workspaceTable.createdAt))
      .limit(limit);

    const workspaces = await workspaceQuery;

    for (const workspace of workspaces) {
      results.push({
        id: workspace.id,
        type: "workspace",
        title: workspace.name,
        description: workspace.description || undefined,
        workspaceId: workspace.id,
        workspaceName: workspace.name,
        createdAt: workspace.createdAt,
        relevanceScore: workspace.relevanceScore,
      });
    }
  }

  if (type === "all" || type === "comments" || type === "activities") {
    const searchableActivityText = sql<string>`COALESCE(${activityTable.content}, CAST(${activityTable.eventData} AS text), '')`;
    const activityRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${searchableActivityText}) LIKE ${searchPattern} THEN 2
        WHEN LOWER(${taskTable.title}) LIKE ${searchPattern} THEN 1
        ELSE 1
      END
    `;

    const activityQuery = db
      .select({
        id: activityTable.id,
        type: activityTable.type,
        content: activityTable.content,
        eventData: activityTable.eventData,
        taskId: activityTable.taskId,
        taskTitle: taskTable.title,
        taskNumber: taskTable.number,
        projectId: projectTable.id,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        userId: activityTable.userId,
        userName: userTable.name,
        createdAt: activityTable.createdAt,
        relevanceScore: activityRelevanceScore.as("relevanceScore"),
      })
      .from(activityTable)
      .leftJoin(taskTable, eq(activityTable.taskId, taskTable.id))
      .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .leftJoin(userTable, eq(activityTable.userId, userTable.id))
      .where(
        and(
          workspaceFilter,
          projectId ? eq(taskTable.projectId, projectId) : undefined,
          or(
            ilike(searchableActivityText, searchPattern),
            ilike(taskTable.title, searchPattern),
          ),
          type === "comments" ? eq(activityTable.type, "comment") : undefined,
        ),
      )
      .orderBy(desc(activityRelevanceScore), desc(activityTable.createdAt))
      .limit(limit);

    const activities = await activityQuery;

    for (const activity of activities) {
      const isComment = activity.type === "comment";
      const activityContent = getActivitySearchContent(
        activity.type,
        activity.content,
        activity.eventData,
      );
      results.push({
        id: activity.id,
        type: isComment ? "comment" : "activity",
        title: isComment
          ? `Comment on ${activity.taskTitle || "task"}`
          : `${activity.type} on ${activity.taskTitle || "task"}`,
        content: activityContent,
        projectId: activity.projectId || undefined,
        projectName: activity.projectName || undefined,
        projectSlug: activity.projectSlug || undefined,
        workspaceId: activity.workspaceId || undefined,
        workspaceName: activity.workspaceName || undefined,
        userId: activity.userId || undefined,
        userName: activity.userName || undefined,
        createdAt: activity.createdAt,
        relevanceScore: activity.relevanceScore,
        taskNumber: activity.taskNumber || undefined,
      });
    }
  }

  results.sort((a, b) => {
    if (a.relevanceScore !== b.relevanceScore) {
      return b.relevanceScore - a.relevanceScore;
    }
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  const finalResults = results.slice(0, limit);

  return {
    results: finalResults,
    totalCount: results.length,
    searchQuery: query,
  };
}

export default globalSearch;
