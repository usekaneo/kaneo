import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { taskTable, timeEntryTable } from "../../database/schema";
import { Database } from "../../effect/database";
import { Events } from "../../effect/events";
import { resolveDuration } from "../duration";
import { TimeEntryCreateFailed } from "../errors";

const createTimeEntry = Effect.fn("timeEntry.createTimeEntry")(function* ({
  taskId,
  userId,
  description,
  startTime,
  endTime,
}: {
  taskId: string;
  userId: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
}) {
  const database = yield* Database;
  const events = yield* Events;

  const duration = yield* resolveDuration(startTime, endTime);

  const [createdTimeEntry] = yield* database.query((db) =>
    db
      .insert(timeEntryTable)
      .values({
        id: createId(),
        taskId,
        userId,
        description: description || "",
        startTime,
        endTime: endTime || null,
        duration,
      })
      .returning(),
  );

  if (!createdTimeEntry) {
    return yield* new TimeEntryCreateFailed({ taskId });
  }

  const [task] = yield* database.query((db) =>
    db
      .select({ userId: taskTable.userId, title: taskTable.title })
      .from(taskTable)
      .where(eq(taskTable.id, taskId)),
  );

  yield* events.publish("time-entry.created", {
    timeEntryId: createdTimeEntry.id,
    taskId: createdTimeEntry.taskId,
    userId,
    type: "create",
    content: "started time tracking",
    taskOwnerId: task?.userId,
    taskTitle: task?.title,
  });

  return createdTimeEntry;
});

export default createTimeEntry;
