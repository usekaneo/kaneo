import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  contactTable,
  projectTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

export const TIMELINE_LEAD_LIMIT = 100;
export const TIMELINE_ENTRY_LIMIT = 200;

// A contact's leads are tasks, and each interaction is a comment on one of
// them. Both lists are limited to projects the caller can open, because leads
// can live in restricted projects.
async function getContactTimeline(
  workspaceId: string,
  contactId: string,
  userId: string,
) {
  const [contact] = await db
    .select({ id: contactTable.id })
    .from(contactTable)
    .where(
      and(
        eq(contactTable.id, contactId),
        eq(contactTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!contact) throw new HTTPException(404, { message: "Contact not found" });

  const visibleLead = and(
    eq(taskTable.contactId, contactId),
    eq(projectTable.workspaceId, workspaceId),
    projectAccessCondition(userId, projectTable.id),
  );

  const leads = await db
    .select({
      id: taskTable.id,
      number: taskTable.number,
      title: taskTable.title,
      status: taskTable.status,
      dueDate: taskTable.dueDate,
      projectId: projectTable.id,
      projectName: projectTable.name,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(visibleLead)
    .orderBy(
      sql`${taskTable.dueDate} asc nulls last`,
      desc(taskTable.createdAt),
    )
    .limit(TIMELINE_LEAD_LIMIT);

  const entries = await db
    .select({
      id: activityTable.id,
      taskId: taskTable.id,
      taskNumber: taskTable.number,
      taskTitle: taskTable.title,
      projectId: projectTable.id,
      content: activityTable.content,
      createdAt: activityTable.createdAt,
      userName: userTable.name,
      userImage: userTable.image,
    })
    .from(activityTable)
    .innerJoin(taskTable, eq(activityTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .innerJoin(userTable, eq(activityTable.userId, userTable.id))
    .where(
      and(
        visibleLead,
        eq(activityTable.type, "comment"),
        isNotNull(activityTable.content),
      ),
    )
    .orderBy(desc(activityTable.createdAt), asc(activityTable.id))
    .limit(TIMELINE_ENTRY_LIMIT);

  return {
    leads,
    entries: entries.map(({ userName, userImage, content, ...entry }) => ({
      ...entry,
      content: content as string,
      user: { name: userName, image: userImage },
    })),
  };
}

export default getContactTimeline;
