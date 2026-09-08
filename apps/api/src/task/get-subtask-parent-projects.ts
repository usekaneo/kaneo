import { and, eq } from "drizzle-orm";
import db from "../database";
import { taskRelationTable, taskTable } from "../database/schema";

/** Find boards whose counters depend on a child, including other projects. */
export async function getSubtaskParentProjects(taskId: string) {
  return db
    .selectDistinct({ projectId: taskTable.projectId })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskRelationTable.sourceTaskId, taskTable.id))
    .where(
      and(
        eq(taskRelationTable.targetTaskId, taskId),
        eq(taskRelationTable.relationType, "subtask"),
      ),
    );
}

/** Deleted relations are gone by broadcast time; their source task still exists. */
export async function getRelationSourceProject(sourceTaskId: string) {
  return db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, sourceTaskId));
}
