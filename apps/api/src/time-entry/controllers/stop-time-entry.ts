import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { timeEntryTable } from "../../database/schema";
import { resolveDuration } from "../duration";

async function stopTimeEntry(timeEntryId: string) {
  const [entry] = await db
    .select()
    .from(timeEntryTable)
    .where(eq(timeEntryTable.id, timeEntryId));

  if (!entry) {
    throw new HTTPException(404, { message: "Time entry not found" });
  }

  // Stopping twice (two tabs, a double click) is harmless.
  if (entry.endTime) return entry;

  const now = new Date();
  const endTime = now > entry.startTime ? now : entry.startTime;

  const [stopped] = await db
    .update(timeEntryTable)
    .set({ endTime, duration: resolveDuration(entry.startTime, endTime) })
    .where(eq(timeEntryTable.id, timeEntryId))
    .returning();

  return stopped;
}

export default stopTimeEntry;
