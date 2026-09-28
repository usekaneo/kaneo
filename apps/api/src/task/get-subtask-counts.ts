import { and, eq, inArray, sql } from "drizzle-orm";
import { projectTable, taskRelationTable, taskTable } from "../database/schema";
import type { TaskReadDatabase } from "./bounded-read";
import { taskIsCompleted } from "./task-is-completed";

/** Load direct-child progress for the entire page, independent of board filters. */
export async function getSubtaskCounts(
  db: TaskReadDatabase,
  taskIds: string[],
  workspaceId: string,
  publicOnly: boolean,
) {
  if (taskIds.length === 0) {
    return new Map<string, { completed: number; total: number }>();
  }

  const rows = await db
    .select({
      taskId: taskRelationTable.sourceTaskId,
      total: sql<number>`count(distinct ${taskTable.id})`.mapWith(Number),
      completed:
        sql<number>`count(distinct ${taskTable.id}) filter (where ${taskIsCompleted})`.mapWith(
          Number,
        ),
    })
    .from(taskRelationTable)
    .innerJoin(taskTable, eq(taskRelationTable.targetTaskId, taskTable.id))
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(
      and(
        inArray(taskRelationTable.sourceTaskId, taskIds),
        eq(taskRelationTable.relationType, "subtask"),
        eq(projectTable.workspaceId, workspaceId),
        publicOnly ? eq(projectTable.isPublic, true) : undefined,
      ),
    )
    .groupBy(taskRelationTable.sourceTaskId);

  return new Map(
    rows.map(({ taskId, completed, total }) => [taskId, { completed, total }]),
  );
}
