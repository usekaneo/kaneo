import { and, eq, exists, or, type SQL } from "drizzle-orm";
import db, { schema } from "../../database";

// True for tasks where the user is any assignee. The primary column is checked
// as well so a row written without a task_assignee row still matches.
export function taskAssignedTo(userId: string): SQL {
  return or(
    eq(schema.taskTable.userId, userId),
    exists(
      db
        .select({ one: schema.taskAssigneeTable.id })
        .from(schema.taskAssigneeTable)
        .where(
          and(
            eq(schema.taskAssigneeTable.taskId, schema.taskTable.id),
            eq(schema.taskAssigneeTable.userId, userId),
          ),
        ),
    ),
  ) as SQL;
}
