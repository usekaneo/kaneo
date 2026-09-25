import { and, eq, inArray } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";

// Only a "blocks" relation carries a scheduling dependency type/lag; editing
// either field on a "related"/"subtask" row would just be silently ignored by
// every reader (the Gantt only reads them off "blocks" edges), so reject it
// outright rather than accept a value nothing will ever show.
async function updateTaskRelation(
  id: string,
  updates: { dependencyType?: string; lagDays?: number },
  userId: string,
  workspaceId: string,
) {
  const workspaceTasks = db
    .select({ id: taskTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(projectTable.workspaceId, workspaceId));

  const [existing] = await db
    .select({
      id: taskRelationTable.id,
      sourceTaskId: taskRelationTable.sourceTaskId,
      targetTaskId: taskRelationTable.targetTaskId,
      relationType: taskRelationTable.relationType,
    })
    .from(taskRelationTable)
    .where(
      and(
        eq(taskRelationTable.id, id),
        inArray(taskRelationTable.sourceTaskId, workspaceTasks),
        inArray(taskRelationTable.targetTaskId, workspaceTasks),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new HTTPException(404, { message: "Task relation not found" });
  }

  if (existing.relationType !== "blocks") {
    throw new HTTPException(400, {
      message: "Only a 'blocks' relation has a dependency type/lag to update",
    });
  }

  if (updates.dependencyType === undefined && updates.lagDays === undefined) {
    throw new HTTPException(400, { message: "No fields to update" });
  }

  const [relation] = await db
    .update(taskRelationTable)
    .set(updates)
    .where(eq(taskRelationTable.id, id))
    .returning();

  if (!relation) {
    throw new HTTPException(500, {
      message: "Failed to update task relation",
    });
  }

  const [sourceTask] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, relation.sourceTaskId))
    .limit(1);

  if (sourceTask) {
    await publishEvent("task-relation.updated", {
      ...relation,
      taskId: relation.sourceTaskId,
      projectId: sourceTask.projectId,
      userId,
    });
  }

  const [targetTask] = await db
    .select({ projectId: taskTable.projectId })
    .from(taskTable)
    .where(eq(taskTable.id, relation.targetTaskId))
    .limit(1);

  if (targetTask && targetTask.projectId !== sourceTask?.projectId) {
    await publishEvent("task-relation.updated", {
      ...relation,
      taskId: relation.sourceTaskId,
      projectId: targetTask.projectId,
      userId,
    });
  }

  return relation;
}

export default updateTaskRelation;
