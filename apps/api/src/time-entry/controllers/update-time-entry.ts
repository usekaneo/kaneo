import { eq, sql } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  taskTable,
  timeEntryTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { resolveDuration } from "../duration";

type UpdateTimeEntryParams = {
  timeEntryId: string;
  userId: string;
  startTime?: Date;
  endTime?: Date;
  duration?: number;
  description?: string;
  billable?: boolean;
};

async function updateTimeEntry(params: UpdateTimeEntryParams) {
  const {
    timeEntryId,
    userId,
    startTime,
    endTime,
    duration,
    description,
    billable,
  } = params;

  const [existingTimeEntry] = await db
    .select()
    .from(timeEntryTable)
    .where(eq(timeEntryTable.id, timeEntryId));

  if (!existingTimeEntry) {
    throw new HTTPException(404, {
      message: "Time entry not found",
    });
  }

  // A running entry's clock belongs to the user tracking it. Timestamps stay
  // immutable until the timer is stopped; only notes can be adjusted.
  if (!existingTimeEntry.endTime) {
    if (existingTimeEntry.userId !== userId) {
      throw new HTTPException(403, {
        message: "Only the user tracking time can edit a running entry",
      });
    }

    if (
      startTime !== undefined ||
      endTime !== undefined ||
      duration !== undefined
    ) {
      throw new HTTPException(400, {
        message:
          "Stop the timer before changing its start time, end time, or duration.",
      });
    }

    if (description === undefined && billable === undefined) {
      return existingTimeEntry;
    }

    const [updatedTimeEntry] = await db
      .update(timeEntryTable)
      .set({
        ...(description !== undefined && { description }),
        ...(billable !== undefined && { billable }),
      })
      .where(eq(timeEntryTable.id, timeEntryId))
      .returning();

    if (!updatedTimeEntry) {
      throw new HTTPException(404, {
        message: "Time entry not found",
      });
    }

    // Running entries have no activity row yet (written at stop), but other
    // tabs and viewers still need the metadata change live.
    const [runningTask] = await db
      .select({ projectId: taskTable.projectId })
      .from(taskTable)
      .where(eq(taskTable.id, updatedTimeEntry.taskId))
      .limit(1);

    await publishEvent("time-entry.updated", {
      timeEntryId: updatedTimeEntry.id,
      taskId: updatedTimeEntry.taskId,
      userId,
      type: "update",
      projectId: runningTask?.projectId,
    });

    return updatedTimeEntry;
  }

  const effectiveStartTime = startTime ?? existingTimeEntry.startTime;
  // A supplied duration takes precedence and derives the end time.
  const effectiveEndTime =
    duration !== undefined
      ? new Date(effectiveStartTime.getTime() + duration * 1000)
      : (endTime ?? existingTimeEntry.endTime);

  const effectiveDuration = resolveDuration(
    effectiveStartTime,
    effectiveEndTime ?? undefined,
  );

  if (
    description === undefined &&
    billable === undefined &&
    effectiveStartTime.getTime() === existingTimeEntry.startTime.getTime() &&
    (effectiveEndTime?.getTime() ?? null) ===
      (existingTimeEntry.endTime?.getTime() ?? null)
  ) {
    return existingTimeEntry;
  }

  // Commit the ended entry and its feed snapshot together. A concurrent delete
  // sees both rows or neither, so the snapshot cannot disagree with the entry.
  const updatedTimeEntry = await db.transaction(async (tx) => {
    const [updated] = await tx
      .update(timeEntryTable)
      .set({
        startTime: effectiveStartTime,
        endTime: effectiveEndTime,
        duration: effectiveDuration,
        ...(description !== undefined && { description }),
        ...(billable !== undefined && { billable }),
      })
      .where(eq(timeEntryTable.id, timeEntryId))
      .returning();

    if (!updated) {
      throw new HTTPException(404, {
        message: "Time entry not found",
      });
    }

    await tx
      .update(activityTable)
      .set({
        eventData: {
          timeEntryId: updated.id,
          duration: updated.duration,
          billable: updated.billable,
        },
      })
      .where(sql`${activityTable.eventData}->>'timeEntryId' = ${timeEntryId}`);

    return updated;
  });

  const [task] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, updatedTimeEntry.taskId))
    .limit(1);

  await publishEvent("time-entry.updated", {
    timeEntryId: updatedTimeEntry.id,
    taskId: updatedTimeEntry.taskId,
    userId,
    type: "update",
    projectId: task?.projectId,
  });

  return updatedTimeEntry;
}

export default updateTimeEntry;
