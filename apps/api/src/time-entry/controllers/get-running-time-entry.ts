import { and, eq, isNull } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable, timeEntryTable } from "../../database/schema";

async function getRunningTimeEntry(userId: string) {
  const [running] = await db
    .select({
      id: timeEntryTable.id,
      taskId: timeEntryTable.taskId,
      userId: timeEntryTable.userId,
      description: timeEntryTable.description,
      billable: timeEntryTable.billable,
      startTime: timeEntryTable.startTime,
      endTime: timeEntryTable.endTime,
      duration: timeEntryTable.duration,
      createdAt: timeEntryTable.createdAt,
      updatedAt: timeEntryTable.updatedAt,
      taskTitle: taskTable.title,
      projectId: projectTable.id,
      workspaceId: projectTable.workspaceId,
    })
    .from(timeEntryTable)
    .innerJoin(taskTable, eq(timeEntryTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(eq(timeEntryTable.userId, userId), isNull(timeEntryTable.endTime)),
    )
    .limit(1);

  return running ?? null;
}

export default getRunningTimeEntry;
