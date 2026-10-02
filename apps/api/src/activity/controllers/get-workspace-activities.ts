import { and, desc, eq, gte, isNull, sql } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { commentExcerpt } from "../comment-excerpt";

export const WORKSPACE_ACTIVITY_LIMIT = 20;

// The feed is "what happened lately". The window also keeps the scan bounded
// in workspaces with years of history.
const WINDOW_DAYS = 30;

async function getWorkspaceActivities(workspaceId: string) {
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Concrete project IDs let PostgreSQL estimate task selectivity before it
  // chooses an activity index. A join-only workspace filter can instead scan
  // every tenant's recent events to fill a quiet workspace's small feed.
  const projects = await db
    .select({ id: projectTable.id })
    .from(projectTable)
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        isNull(projectTable.archivedAt),
      ),
    );
  if (!projects.length) return [];

  const rows = await db
    .select({
      id: activityTable.id,
      type: activityTable.type,
      createdAt: activityTable.createdAt,
      content: activityTable.content,
      eventData: activityTable.eventData,
      userId: activityTable.userId,
      userName: userTable.name,
      userImage: userTable.image,
      externalUserName: activityTable.externalUserName,
      externalUserAvatar: activityTable.externalUserAvatar,
      taskId: taskTable.id,
      taskTitle: taskTable.title,
      taskNumber: taskTable.number,
      projectId: projectTable.id,
      projectSlug: projectTable.slug,
    })
    .from(activityTable)
    .innerJoin(taskTable, eq(activityTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(activityTable.userId, userTable.id))
    .where(
      and(
        eq(projectTable.workspaceId, workspaceId),
        sql`${taskTable.projectId} = ANY(${sql.param(projects.map((project) => project.id))}::text[])`,
        isNull(projectTable.archivedAt),
        gte(activityTable.createdAt, since),
      ),
    )
    .orderBy(desc(activityTable.createdAt), desc(activityTable.id))
    .limit(WORKSPACE_ACTIVITY_LIMIT);

  return rows.map(({ content, ...row }) => ({
    ...row,
    excerpt: commentExcerpt(content),
  }));
}

export default getWorkspaceActivities;
