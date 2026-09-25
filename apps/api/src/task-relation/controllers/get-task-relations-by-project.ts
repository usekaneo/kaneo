import { eq, inArray, or } from "drizzle-orm";
import db from "../../database";
import { taskRelationTable, taskTable } from "../../database/schema";
import resolveRelationsWithTasks from "./resolve-relations-with-tasks";

// Powers the Gantt chart's dependency lines: one call gets every relation
// touching the project's tasks, instead of one request per task. A relation
// whose other end sits outside the project (a cross-project `related` link,
// say) is still included with that task's summary, same as the single-task
// endpoint — the caller decides whether it can place the far end on screen.
async function getTaskRelationsByProject(
  projectId: string,
  workspaceId: string,
) {
  // A subquery rather than a materialized ID list: `inArray` with tens of
  // thousands of literal values can overflow Postgres's bind-parameter
  // limit on a large project, while a subquery lets the DB filter server-side
  // with a single parameter.
  const projectTaskIds = db
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(eq(taskTable.projectId, projectId));

  const relations = await db
    .select({
      id: taskRelationTable.id,
      sourceTaskId: taskRelationTable.sourceTaskId,
      targetTaskId: taskRelationTable.targetTaskId,
      relationType: taskRelationTable.relationType,
      createdAt: taskRelationTable.createdAt,
    })
    .from(taskRelationTable)
    .where(
      or(
        inArray(taskRelationTable.sourceTaskId, projectTaskIds),
        inArray(taskRelationTable.targetTaskId, projectTaskIds),
      ),
    );

  return resolveRelationsWithTasks(relations, workspaceId);
}

export default getTaskRelationsByProject;
