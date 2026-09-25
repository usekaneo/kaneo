import { eq, or } from "drizzle-orm";
import db from "../../database";
import { taskRelationTable } from "../../database/schema";
import resolveRelationsWithTasks from "./resolve-relations-with-tasks";

async function getTaskRelations(taskId: string, workspaceId: string) {
  const relations = await db
    .select({
      id: taskRelationTable.id,
      sourceTaskId: taskRelationTable.sourceTaskId,
      targetTaskId: taskRelationTable.targetTaskId,
      relationType: taskRelationTable.relationType,
      dependencyType: taskRelationTable.dependencyType,
      lagDays: taskRelationTable.lagDays,
      createdAt: taskRelationTable.createdAt,
    })
    .from(taskRelationTable)
    .where(
      or(
        eq(taskRelationTable.sourceTaskId, taskId),
        eq(taskRelationTable.targetTaskId, taskId),
      ),
    );

  return resolveRelationsWithTasks(relations, workspaceId);
}

export default getTaskRelations;
