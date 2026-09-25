import { and, eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  taskTable,
  timeEntryTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

async function deleteTimeEntry(timeEntryId: string) {
  const [existingTimeEntry] = await db
    .select()
    .from(timeEntryTable)
    .where(eq(timeEntryTable.id, timeEntryId));

  if (!existingTimeEntry) {
    throw new HTTPException(404, {
      message: "Time entry not found",
    });
  }

  if (!existingTimeEntry.endTime) {
    throw new HTTPException(409, {
      message: "Stop the timer before deleting its time entry.",
    });
  }

  const [deletedTimeEntry] = await db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(timeEntryTable)
      .where(eq(timeEntryTable.id, timeEntryId))
      .returning();

    if (!deleted) {
      throw new HTTPException(404, {
        message: "Time entry not found",
      });
    }

    // One completed entry maps to exactly one activity row (see the
    // time-entry.created subscriber). Remove it in the same transaction so
    // the feed never shows hours that no longer exist.
    await tx
      .delete(activityTable)
      .where(
        and(
          eq(activityTable.taskId, deleted.taskId),
          eq(activityTable.type, "time_tracked"),
          sql`${activityTable.eventData}->>'timeEntryId' = ${timeEntryId}`,
        ),
      );

    return [deleted];
  });

  if (!deletedTimeEntry) {
    throw new HTTPException(404, {
      message: "Time entry not found",
    });
  }

  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, deletedTimeEntry.taskId))
    .limit(1);

  await publishEvent("time-entry.deleted", {
    timeEntryId: deletedTimeEntry.id,
    taskId: deletedTimeEntry.taskId,
    userId: deletedTimeEntry.userId,
    type: "delete",
    projectId: task?.projectId,
  });

  return deletedTimeEntry;
}

export default deleteTimeEntry;
