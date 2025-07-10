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
  userEmail: string;
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
  userEmail?: string;
  userName?: string;
  createdAt: Date;
  relevanceScore: number;
  taskNumber?: number;
  projectSlug?: string;
  priority?: string;
  status?: string;
};

async function globalSearch(params: SearchParams): Promise<{
  results: SearchResult[];
  totalCount: number;
  searchQuery: string;
}> {
  const {
    query,
    userEmail,
    type = "all",
    workspaceId,
    projectId,
    limit = 20,
  } = params;

  const userWorkspaces = await db
    .select({ workspaceId: workspaceUserTable.workspaceId })
    .from(workspaceUserTable)
    .where(eq(workspaceUserTable.userEmail, userEmail));

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

  if (type === "all" || type === "tasks") {
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
        userEmail: taskTable.userEmail,
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
      .leftJoin(userTable, eq(taskTable.userEmail, userTable.email))
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
        userEmail: task.userEmail || undefined,
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
        ownerEmail: workspaceTable.ownerEmail,
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
        userEmail: workspace.ownerEmail,
        createdAt: workspace.createdAt,
        relevanceScore: workspace.relevanceScore,
      });
    }
  }

  if (type === "all" || type === "comments" || type === "activities") {
    const activityRelevanceScore = sql<number>`
      CASE
        WHEN LOWER(${activityTable.content}) LIKE ${searchPattern} THEN 2
        WHEN LOWER(${taskTable.title}) LIKE ${searchPattern} THEN 1
        ELSE 1
      END
    `;

    const activityQuery = db
      .select({
        id: activityTable.id,
        type: activityTable.type,
        content: activityTable.content,
        taskId: activityTable.taskId,
        taskTitle: taskTable.title,
        taskNumber: taskTable.number,
        projectId: projectTable.id,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        workspaceId: projectTable.workspaceId,
        workspaceName: workspaceTable.name,
        userEmail: activityTable.userEmail,
        userName: userTable.name,
        createdAt: activityTable.createdAt,
        relevanceScore: activityRelevanceScore.as("relevanceScore"),
      })
      .from(activityTable)
      .leftJoin(taskTable, eq(activityTable.taskId, taskTable.id))
      .leftJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(workspaceTable, eq(projectTable.workspaceId, workspaceTable.id))
      .leftJoin(userTable, eq(activityTable.userEmail, userTable.email))
      .where(
        and(
          workspaceFilter,
          projectId ? eq(taskTable.projectId, projectId) : undefined,
          or(
            ilike(activityTable.content, searchPattern),
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
      results.push({
        id: activity.id,
        type: isComment ? "comment" : "activity",
        title: isComment
          ? `Comment on ${activity.taskTitle || "task"}`
          : `${activity.type} on ${activity.taskTitle || "task"}`,
        content: activity.content || undefined,
        projectId: activity.projectId || undefined,
        projectName: activity.projectName || undefined,
        projectSlug: activity.projectSlug || undefined,
        workspaceId: activity.workspaceId || undefined,
        workspaceName: activity.workspaceName || undefined,
        userEmail: activity.userEmail || undefined,
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
