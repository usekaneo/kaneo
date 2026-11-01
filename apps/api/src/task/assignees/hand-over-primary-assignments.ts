import { sql } from "drizzle-orm";
import db from "../../database";

type Database = Pick<typeof db, "execute">;

// Deleting a user nulls task.assignee_id through its foreign key but only removes
// that user's task_assignee rows, which would leave co-assignees with no primary.
// Hand each of their tasks to the next remaining assignee first. A task with no
// one else left simply loses its primary, as before.
export async function handOverPrimaryAssignments(
  userId: string,
  database: Database = db,
) {
  await database.execute(sql`
    UPDATE task
    SET assignee_id = (
      SELECT assignee.user_id
      FROM task_assignee AS assignee
      WHERE assignee.task_id = task.id AND assignee.user_id <> ${userId}
      ORDER BY assignee.created_at, assignee.id
      LIMIT 1
    )
    WHERE task.assignee_id = ${userId}
  `);
}
