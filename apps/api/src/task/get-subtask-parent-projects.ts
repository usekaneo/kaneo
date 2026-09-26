import { and, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import db from "../database";
import { taskRelationTable, taskTable } from "../database/schema";

/** Find boards whose counters depend on a child, including other projects. */
export async function getSubtaskParentProjects(taskIds: string[]) {
  if (taskIds.length === 0) return [];
  return db
    .selectDistinct({ projectId: taskTable.projectId })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskRelationTable.sourceTaskId, taskTable.id))
    .where(
      and(
        inArray(taskRelationTable.targetTaskId, taskIds),
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

/** Find affected parent boards before a project cascade or column change. */
export async function getProjectSubtaskParentProjects(
  projectId: string,
  status?: string,
) {
  const child = alias(taskTable, "child");
  return db
    .selectDistinct({ projectId: taskTable.projectId })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskRelationTable.sourceTaskId, taskTable.id))
    .innerJoin(child, eq(taskRelationTable.targetTaskId, child.id))
    .where(
      and(
        eq(child.projectId, projectId),
        status === undefined ? undefined : eq(child.status, status),
        eq(taskRelationTable.relationType, "subtask"),
      ),
    );
}
