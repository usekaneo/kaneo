import { and, eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../database";
import { contactTable } from "../database/schema";

// Contacts are workspace-wide, so a task may only point at its own workspace's.
export async function assertContactInWorkspace(
  contactId: string,
  workspaceId: string,
  database: Pick<typeof db, "select"> = db,
) {
  const [row] = await database
    .select({ id: contactTable.id })
    .from(contactTable)
    .where(
      and(
        eq(contactTable.id, contactId),
        eq(contactTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) throw new HTTPException(404, { message: "Contact not found" });
}
