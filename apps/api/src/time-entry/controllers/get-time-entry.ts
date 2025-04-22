import { eq } from "drizzle-orm";
import db from "../../database";
import { timeEntryTable } from "../../database/schema";

async function getTimeEntry(id: string) {
  const [timeEntry] = await db
    .select()
    .from(timeEntryTable)
    .where(eq(timeEntryTable.id, id));

  return timeEntry;
}

export default getTimeEntry;
