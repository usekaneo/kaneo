import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { timeEntryTable } from "../../database/schema";

async function deleteTimeEntry(timeEntryId: string) {
  const [deleted] = await db
    .delete(timeEntryTable)
    .where(eq(timeEntryTable.id, timeEntryId))
    .returning();

  if (!deleted) {
    throw new HTTPException(404, { message: "Time entry not found" });
  }

  return deleted;
}

export default deleteTimeEntry;
