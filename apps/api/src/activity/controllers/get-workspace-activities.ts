import { and, desc, eq, gte, inArray, isNull, sql } from "drizzle-orm";
import db from "../../database";
import {
  activityTable,
  columnTable,
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

  const statusChanges = rows.filter((row) => row.type === "status_changed");
  const statusSlugs = [
    ...new Set(
      statusChanges.flatMap((row) => {
        const data = statusData(row.eventData);
        return [data?.oldStatus, data?.newStatus].filter(
          (value): value is string => typeof value === "string",
        );
      }),
    ),
  ];
  const columns = statusSlugs.length
    ? await db
        .select({
          projectId: columnTable.projectId,
          slug: columnTable.slug,
          name: columnTable.name,
        })
        .from(columnTable)
        .innerJoin(projectTable, eq(columnTable.projectId, projectTable.id))
        .where(
          and(
            eq(projectTable.workspaceId, workspaceId),
            inArray(columnTable.projectId, [
              ...new Set(statusChanges.map((row) => row.projectId)),
            ]),
            inArray(columnTable.slug, statusSlugs),
          ),
        )
    : [];

  return rows.map(({ content, ...row }) => {
    const data =
      row.type === "status_changed" ? statusData(row.eventData) : null;
    const nameOf = (slug: unknown) => {
      const matching = columns.filter(
        (column) => column.projectId === row.projectId && column.slug === slug,
      );
      // Historical events only store slugs. Duplicates cannot identify a column.
      return matching.length === 1 ? matching[0]?.name : undefined;
    };
    return {
      ...row,
      eventData: data
        ? {
            ...data,
            oldStatusName: nameOf(data.oldStatus),
            newStatusName: nameOf(data.newStatus),
          }
        : row.eventData,
      excerpt: commentExcerpt(content),
    };
  });
}

function statusData(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export default getWorkspaceActivities;
