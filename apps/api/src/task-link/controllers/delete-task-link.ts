import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskLinkTable } from "../../database/schema";
import { publishEvent } from "../../events";

/**
 * Delete an existing task link by its ID.
 * Emits a 'taskLink.deleted' event after removing the record.
 */
async function deleteTaskLink(linkId: string) {
  const existing = await db
    .select({ id: taskLinkTable.id })
    .from(taskLinkTable)
    .where(eq(taskLinkTable.id, linkId));

  if (!existing.length) {
    throw new HTTPException(404, { message: "Link not found" });
  }

  await db.delete(taskLinkTable).where(eq(taskLinkTable.id, linkId));
  await publishEvent("taskLink.deleted", { linkId });
  return true;
}

export default deleteTaskLink;
