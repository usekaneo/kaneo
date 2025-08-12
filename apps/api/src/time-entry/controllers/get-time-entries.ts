import { eq } from "drizzle-orm";
import db from "../../database";
import { timeEntryTable, userTable } from "../../database/schema";

async function getTimeEntriesByTaskId(taskId: string) {
  const timeEntries = await db
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
    })
    .from(timeEntryTable)
    .leftJoin(userTable, eq(timeEntryTable.userId, userTable.id))
    .where(eq(timeEntryTable.taskId, taskId))
    .orderBy(timeEntryTable.startTime);

  return timeEntries;
}

export default getTimeEntriesByTaskId;
