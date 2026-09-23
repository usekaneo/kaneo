import { randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNotNull, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import {
  calendarFeedTable,
  labelTable,
  projectTable,
  taskTable,
} from "../database/schema";
import { buildCalendar } from "./ical";

export async function createCalendarFeed(
  projectId: string,
  workspaceId: string,
  labelIds: string[],
  timeZone: string,
) {
  const ids = [...new Set(labelIds)];
  const labels = await db
    .select({ id: labelTable.id })
    .from(labelTable)
    .where(
      and(eq(labelTable.workspaceId, workspaceId), inArray(labelTable.id, ids)),
    );
  if (labels.length !== ids.length) {
    throw new HTTPException(400, {
      message: "Select labels from this workspace",
    });
  }
  const [feed] = await db
    .insert(calendarFeedTable)
    .values({
      projectId,
      labelIds: ids,
      timeZone,
      token: randomBytes(32).toString("hex"),
    })
    .returning();
  return feed;
}

export function listCalendarFeeds(projectId: string) {
  return db
    .select()
    .from(calendarFeedTable)
    .where(eq(calendarFeedTable.projectId, projectId))
    .orderBy(asc(calendarFeedTable.createdAt), asc(calendarFeedTable.id));
}

export async function revokeCalendarFeed(projectId: string, id: string) {
  const [feed] = await db
    .delete(calendarFeedTable)
    .where(
      and(
        eq(calendarFeedTable.projectId, projectId),
        eq(calendarFeedTable.id, id),
      ),
    )
    .returning({ id: calendarFeedTable.id });
  if (!feed)
    throw new HTTPException(404, { message: "Calendar feed not found" });
  return { success: true };
}

export async function getCalendarFeed(token: string) {
  const [record] = await db
    .select({ feed: calendarFeedTable, project: projectTable })
    .from(calendarFeedTable)
    .innerJoin(projectTable, eq(projectTable.id, calendarFeedTable.projectId))
    .where(eq(calendarFeedTable.token, token));
  if (!record)
    throw new HTTPException(404, { message: "Calendar feed not found" });
  const { feed, project } = record;
  // Resolve IDs on every refresh so renaming a label preserves subscriptions.
  // Missing/deleted labels must never broaden a feed to all project tasks.
  const labels = feed.labelIds.length
    ? await db
        .select({ name: labelTable.name })
        .from(labelTable)
        .where(
          and(
            eq(labelTable.workspaceId, project.workspaceId),
            inArray(labelTable.id, feed.labelIds),
          ),
        )
    : [];
  const tasks = labels.length
    ? await db
        .selectDistinct({
          id: taskTable.id,
          title: taskTable.title,
          description: taskTable.description,
          startDate: taskTable.startDate,
          dueDate: taskTable.dueDate,
          createdAt: taskTable.createdAt,
          updatedAt: taskTable.updatedAt,
        })
        .from(taskTable)
        .innerJoin(labelTable, eq(labelTable.taskId, taskTable.id))
        .where(
          and(
            eq(taskTable.projectId, project.id),
            eq(labelTable.workspaceId, project.workspaceId),
            inArray(
              labelTable.name,
              labels.map((label) => label.name),
            ),
            or(isNotNull(taskTable.startDate), isNotNull(taskTable.dueDate)),
          ),
        )
        .orderBy(asc(taskTable.id))
    : [];
  return buildCalendar({ name: project.name, timeZone: feed.timeZone, tasks });
}
