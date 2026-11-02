import { and, asc, count, eq, ilike, or } from "drizzle-orm";
import db from "../../database";
import { contactTable, projectTable, taskTable } from "../../database/schema";
import { projectAccessCondition } from "../../project-access/project-access-condition";
import { contactColumns } from "../contact-columns";
import { ensureDefaultOptions } from "../options/ensure-default-options";
import { resolveOptionKey } from "../options/resolve-option";

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
  // Labels come from the options, so make sure the defaults exist first.
  await ensureDefaultOptions(workspaceId);
  const conditions = [eq(contactTable.workspaceId, workspaceId)];
  const typeKey = await resolveOptionKey(workspaceId, "type", type);
  const regionKey = await resolveOptionKey(workspaceId, "region", region);
  if (typeKey) conditions.push(eq(contactTable.type, typeKey));
  if (regionKey) conditions.push(eq(contactTable.region, regionKey));
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
      ...contactColumns,
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
