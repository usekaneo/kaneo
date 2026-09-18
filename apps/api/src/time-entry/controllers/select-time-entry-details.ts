import { eq } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskTable,
  timeEntryTable,
  userTable,
} from "../../database/schema";

// Time entries with enough context to show them outside their task:
// timesheets, CSV export, the header timer.
export function selectTimeEntryDetails() {
  return db
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
      taskTitle: taskTable.title,
      taskNumber: taskTable.number,
      projectId: projectTable.id,
      projectName: projectTable.name,
      projectSlug: projectTable.slug,
    })
    .from(timeEntryTable)
    .innerJoin(taskTable, eq(timeEntryTable.taskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .leftJoin(userTable, eq(timeEntryTable.userId, userTable.id));
}
