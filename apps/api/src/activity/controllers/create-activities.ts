import db from "../../database";
import { activityTable } from "../../database/schema";

type NewActivity = typeof activityTable.$inferInsert;

// Postgres caps a statement at 65535 bind parameters and each row binds a
// handful of columns, so a batch that scales with a project's task count has
// to be chunked rather than sent as one statement.
const INSERT_CHUNK_SIZE = 500;

async function createActivities(activities: NewActivity[]) {
  for (let index = 0; index < activities.length; index += INSERT_CHUNK_SIZE) {
    await db
      .insert(activityTable)
      .values(activities.slice(index, index + INSERT_CHUNK_SIZE));
  }
}

export default createActivities;
