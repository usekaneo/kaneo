import { sql } from "drizzle-orm";
import { columnTable, taskTable } from "../database/schema";
import { taskIsCompleted } from "./task-is-completed";

// The referenced column decides whether a task is done; the slug is a fallback
// for tasks that predate column ids.
export const taskInFinalColumn = sql<boolean>`coalesce((
  select ${columnTable.isFinal} from ${columnTable}
  where ${columnTable.id} = ${taskTable.columnId}
    and ${columnTable.projectId} = ${taskTable.projectId}
), ${taskIsCompleted})`;
