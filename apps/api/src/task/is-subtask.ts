import { sql } from "drizzle-orm";
import { taskRelationTable, taskTable } from "../database/schema";

// Return only membership, never the identity of a parent in another project.
export const isSubtask = sql<boolean>`exists (
  select 1 from ${taskRelationTable}
  where ${taskRelationTable.targetTaskId} = ${taskTable.id}
    and ${taskRelationTable.relationType} = 'subtask'
)`;
