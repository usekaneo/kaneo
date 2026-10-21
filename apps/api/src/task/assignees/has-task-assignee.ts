import { eq, or, sql, type SQLWrapper } from "drizzle-orm";
import { taskTable, taskCoAssigneeTable } from "../../database/schema";

export function hasTaskAssignee(userId: string | SQLWrapper) {
  return or(
    eq(taskTable.userId, userId),
    sql`exists (select 1 from ${taskCoAssigneeTable} where ${taskCoAssigneeTable.taskId} = ${taskTable.id} and ${taskCoAssigneeTable.userId} = ${userId})`,
  );
}
