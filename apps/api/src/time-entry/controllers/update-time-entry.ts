import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { timeEntryTable } from "../../database/schema";

interface UpdateTimeEntryParams {
  timeEntryId: string;
  startTime: Date;
  endTime?: Date;
  description?: string;
}

async function updateTimeEntry(params: UpdateTimeEntryParams) {
  const { timeEntryId, startTime, endTime, description } = params;

  const [existingTimeEntry] = await db
    .select()
    .from(timeEntryTable)
    .where(eq(timeEntryTable.id, timeEntryId));

  if (!existingTimeEntry) {
    throw new HTTPException(404, {
      message: "Time entry not found",
    });
  }

  // Calculate duration if both startTime and endTime are provided
  let duration: number | null = null;
  if (endTime) {
    duration = Math.floor((endTime.getTime() - startTime.getTime()) / 1000); // duration in seconds
  }

  const [updatedTimeEntry] = await db
    .update(timeEntryTable)
    .set({
      startTime,
      endTime: endTime || null,
      duration,
      ...(description !== undefined && { description }),
    })
    .where(eq(timeEntryTable.id, timeEntryId))
    .returning();

  return updatedTimeEntry;
}

export default updateTimeEntry;
