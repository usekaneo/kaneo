import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { timeEntryTable, userTable } from "../../database/schema";
import { Database } from "../../effect/database";

const getTimeEntriesByTaskId = Effect.fn("timeEntry.getTimeEntriesByTaskId")(
  function* (taskId: string) {
    const database = yield* Database;

    return yield* database.query((db) =>
      db
        .select({
          id: timeEntryTable.id,
          taskId: timeEntryTable.taskId,
          userId: timeEntryTable.userId,
          userName: userTable.name,
          description: timeEntryTable.description,
          startTime: timeEntryTable.startTime,
          endTime: timeEntryTable.endTime,
          duration: timeEntryTable.duration,
          createdAt: timeEntryTable.createdAt,
          updatedAt: timeEntryTable.updatedAt,
        })
        .from(timeEntryTable)
        .leftJoin(userTable, eq(timeEntryTable.userId, userTable.id))
        .where(eq(timeEntryTable.taskId, taskId))
        .orderBy(timeEntryTable.startTime),
    );
  },
);

export default getTimeEntriesByTaskId;
