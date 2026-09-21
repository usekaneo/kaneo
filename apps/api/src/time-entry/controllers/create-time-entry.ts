import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  activityTable,
  taskTable,
  timeEntryTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { resolveDuration } from "../duration";

async function createTimeEntry({
  taskId,
  userId,
  description,
  billable,
  startTime,
  endTime,
}: {
  taskId: string;
  userId: string;
  description?: string;
  billable?: boolean;
  startTime: Date;
  endTime: Date;
}) {
  // Manual entries are always closed: ended rows never collide with the
  // one-running-entry-per-user index, so no conflict mapping is needed.
  // Entry and activity row commit atomically, so concurrent deletes or edits
  // see both or neither and no ghost feed row can ever land.
  const duration = resolveDuration(startTime, endTime);

  const [createdTimeEntry] = await db.transaction(async (tx) => {
    const [created] = await tx
      .insert(timeEntryTable)
      .values({
        id: createId(),
        taskId,
        userId,
        description: description || "",
        billable: billable ?? true,
        startTime,
        endTime,
        duration,
      })
      .returning();

    if (!created) {
      throw new HTTPException(500, {
        message: "Failed to create time entry",
      });
    }

    await tx.insert(activityTable).values({
      taskId: created.taskId,
      type: "time_tracked",
      userId,
      content: null,
      eventData: {
        timeEntryId: created.id,
        duration: created.duration,
        billable: created.billable,
      },
    });

    return [created];
  });

  if (!createdTimeEntry) {
    throw new HTTPException(500, {
      message: "Failed to create time entry",
    });
  }

  const [task] = await db
    .select({
      userId: taskTable.userId,
      title: taskTable.title,
      projectId: taskTable.projectId,
    })
    .from(taskTable)
    .where(eq(taskTable.id, taskId))
    .limit(1);

  await publishEvent("time-entry.created", {
    timeEntryId: createdTimeEntry.id,
    taskId: createdTimeEntry.taskId,
    userId,
    type: "create",
    content: "tracked time",
    taskOwnerId: task?.userId,
    taskTitle: task?.title,
    projectId: task?.projectId,
    duration: createdTimeEntry.duration,
    billable: createdTimeEntry.billable,
  });

  return createdTimeEntry;
}

export default createTimeEntry;
