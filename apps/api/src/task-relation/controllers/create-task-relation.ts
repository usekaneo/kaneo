import { and, eq, or } from "drizzle-orm";
import { HTTPException } from "hono/http-exception";
import db from "../../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";
import { publishEvent } from "../../events";
import { wouldCreateCycle } from "./detect-relation-cycle";

async function createTaskRelation({
  sourceTaskId,
  targetTaskId,
  relationType,
  dependencyType,
  lagDays,
  userId,
  workspaceId,
}: {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
  dependencyType?: string;
  lagDays?: number;
  userId: string;
  workspaceId: string;
}) {
  if (sourceTaskId === targetTaskId) {
    throw new HTTPException(400, {
      message: "Cannot create a relation between a task and itself",
    });
  }

  const [sourceTask] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskTable.id, sourceTaskId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!sourceTask) {
    throw new HTTPException(404, { message: "Source task not found" });
  }

  const [targetTask] = await db
    .select({
      id: taskTable.id,
      projectId: taskTable.projectId,
      workspaceId: projectTable.workspaceId,
    })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        eq(taskTable.id, targetTaskId),
        eq(projectTable.workspaceId, workspaceId),
      ),
    )
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

  // "blocks" (scheduling dependency) and "subtask" (parent/child hierarchy)
  // are both directional graphs where a cycle is a modeling error; "related"
  // is bidirectional and has no cycle concept.
  if (relationType === "blocks" || relationType === "subtask") {
    const createsCycle = await wouldCreateCycle({
      workspaceId,
      relationType,
      sourceTaskId,
      targetTaskId,
    });
    if (createsCycle) {
      throw new HTTPException(409, {
        message: "This dependency would create a circular dependency",
      });
    }
  }

  // dependencyType/lagDays are only meaningful for a "blocks" relation (the
  // Gantt's scheduling dependency); a "related"/"subtask" row keeps the
  // fs/0 defaults regardless of what the caller sent.
  const [relation] = await db
    .insert(taskRelationTable)
    .values({
      sourceTaskId,
      targetTaskId,
      relationType,
      ...(relationType === "blocks"
        ? {
            dependencyType: dependencyType ?? "fs",
            lagDays: lagDays ?? 0,
          }
        : {}),
    })
    .returning();

  if (!relation) {
    throw new HTTPException(500, {
      message: "Failed to create task relation",
    });
  }

  await publishEvent("task-relation.created", {
    ...relation,
    taskId: sourceTaskId,
    projectId: sourceTask.projectId,
    userId,
  });

  // A relation can link tasks across two projects in the same workspace.
  // Notify the target project's subscribers too, so their Gantt/dependency
  // views (which read the target project's task-relations cache) refresh
  // without a manual reload.
  if (targetTask.projectId !== sourceTask.projectId) {
    await publishEvent("task-relation.created", {
      ...relation,
      taskId: sourceTaskId,
      projectId: targetTask.projectId,
      userId,
    });
  }

  return relation;
}

export default createTaskRelation;
