import { createId } from "@paralleldrive/cuid2";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { timeEntryTable } from "../../database/schema";
import { publishEvent } from "../../events";

async function createTimeEntry({
  taskId,
  userEmail,
  description,
  startTime,
  endTime,
  duration,
}: {
  taskId: string;
  userEmail: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}) {
  const [createdTimeEntry] = await db
    .insert(timeEntryTable)
    .values({
      id: createId(),
      taskId,
      userEmail,
      description: description || "",
      startTime,
      endTime: endTime || null,
      duration: duration || 0,
    })
    .returning();

  if (!createdTimeEntry) {
    throw new HTTPException(500, {
      message: "Failed to create time entry",
    });
  }

  await publishEvent("time-entry.created", {
    timeEntryId: createdTimeEntry.id,
    taskId: createdTimeEntry.taskId,
    userEmail,
    type: "create",
    content: "started time tracking",
  });

  return createdTimeEntry;
}

export default createTimeEntry;
