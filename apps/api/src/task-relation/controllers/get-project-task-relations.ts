import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { taskRelationTable, taskTable } from "../../database/schema";

/**
 * Every relation joining two tasks in the project.
 *
 * The per-task endpoint cannot serve a list view, which would otherwise need
 * one request per row. Relations reaching outside the project are excluded
 * rather than returned with a dangling end: the view can only render a task it
 * is already showing, and the id alone would expose a task the caller may not
 * be able to open.
 */
async function getProjectTaskRelations(projectId: string) {
  const projectTaskIds = db
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));

  return db
    .select({
      id: taskRelationTable.id,
      sourceTaskId: taskRelationTable.sourceTaskId,
      targetTaskId: taskRelationTable.targetTaskId,
      relationType: taskRelationTable.relationType,
      createdAt: taskRelationTable.createdAt,
    })
    .from(taskRelationTable)
    .where(
      and(
        inArray(taskRelationTable.sourceTaskId, projectTaskIds),
        inArray(taskRelationTable.targetTaskId, projectTaskIds),
      ),
    );
}

export default getProjectTaskRelations;
