import { sql } from "drizzle-orm";
import { taskTable } from "../database/schema";

// Shared ordering weight so every task list ranks priorities the same way.
export const priorityRank = sql<number>`CASE
  WHEN ${taskTable.priority} = 'urgent' THEN 4
  WHEN ${taskTable.priority} = 'high' THEN 3
  WHEN ${taskTable.priority} = 'medium' THEN 2
  WHEN ${taskTable.priority} = 'low' THEN 1
  ELSE 0
END`;
