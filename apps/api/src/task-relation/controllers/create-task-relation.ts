import { and, eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import { taskRelationTable, taskTable } from "../../database/schema";

async function createTaskRelation({
  sourceTaskId,
  targetTaskId,
  relationType,
}: {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
}) {
  if (sourceTaskId === targetTaskId) {
    throw new HTTPException(400, {
      message: "Cannot create a relation between a task and itself",
    });
  }

  const [sourceTask] = await db
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(eq(taskTable.id, sourceTaskId))
    .limit(1);

  if (!sourceTask) {
    throw new HTTPException(404, { message: "Source task not found" });
  }

  const [targetTask] = await db
    .select({ id: taskTable.id })
    .from(taskTable)
    .where(eq(taskTable.id, targetTaskId))
    .limit(1);

  if (!targetTask) {
    throw new HTTPException(404, { message: "Target task not found" });
  }

  const existing = await db
    .select({ id: taskRelationTable.id })
    .from(taskRelationTable)
    .where(
      and(
        eq(taskRelationTable.relationType, relationType),
        or(
          and(
            eq(taskRelationTable.sourceTaskId, sourceTaskId),
            eq(taskRelationTable.targetTaskId, targetTaskId),
          ),
          and(
            eq(taskRelationTable.sourceTaskId, targetTaskId),
            eq(taskRelationTable.targetTaskId, sourceTaskId),
          ),
        ),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    throw new HTTPException(409, {
      message: "This relation already exists",
    });
  }

  const [relation] = await db
    .insert(taskRelationTable)
    .values({
      sourceTaskId,
      targetTaskId,
      relationType,
    })
    .returning();

  if (!relation) {
    throw new HTTPException(500, {
      message: "Failed to create task relation",
    });
  }

  return relation;
}

export default createTaskRelation;
