import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import db from "../../database";
import { contactTable, projectTable, taskTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";

type ListContactsInput = {
  workspaceId: string;
  userId: string;
  search?: string;
  type?: string;
  region?: string;
};

// leadCount counts linked tasks in projects the caller can open, so a private
// project's leads are not revealed; completed statuses vary per project.
async function listContacts({
  workspaceId,
  userId,
  search,
  type,
  region,
}: ListContactsInput) {
  const conditions = [eq(contactTable.workspaceId, workspaceId)];
  if (type) conditions.push(eq(contactTable.type, type));
  if (region) conditions.push(eq(contactTable.region, region));
  if (search) {
    const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
    const match = or(
      ilike(contactTable.name, pattern),
      ilike(contactTable.phone, pattern),
      ilike(contactTable.email, pattern),
    );
    if (match) conditions.push(match);
  }

  return db
    .select({
      id: contactTable.id,
      workspaceId: contactTable.workspaceId,
      name: contactTable.name,
      phone: contactTable.phone,
      email: contactTable.email,
      type: contactTable.type,
      region: contactTable.region,
      notes: contactTable.notes,
      createdAt: contactTable.createdAt,
      updatedAt: contactTable.updatedAt,
      leadCount: count(projectTable.id),
    })
    .from(contactTable)
    .leftJoin(taskTable, eq(taskTable.contactId, contactTable.id))
    .leftJoin(
      projectTable,
      and(
        eq(projectTable.id, taskTable.projectId),
        eq(projectTable.workspaceId, contactTable.workspaceId),
        projectAccessCondition(userId, projectTable.id),
      ),
    )
    .where(and(...conditions))
    .groupBy(contactTable.id)
    .orderBy(asc(contactTable.name), asc(contactTable.id))
    .limit(500);
}

export default listContacts;
