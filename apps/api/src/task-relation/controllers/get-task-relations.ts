import { and, eq, inArray, or } from "drizzle-orm";
import { Effect } from "effect";
import {
  projectTable,
  taskRelationTable,
  taskTable,
  userTable,
} from "../../database/schema";
import { Database } from "../../effect/database";

const getTaskRelations = Effect.fn("taskRelation.getTaskRelations")(function* (
  taskId: string,
  workspaceId: string,
) {
  const database = yield* Database;

  const relations = yield* database.query((db) =>
    db
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
          eq(taskRelationTable.sourceTaskId, taskId),
          eq(taskRelationTable.targetTaskId, taskId),
        ),
      ),
  );

  const taskIds = new Set<string>();
  for (const rel of relations) {
    taskIds.add(rel.sourceTaskId);
    taskIds.add(rel.targetTaskId);
  }

  const tasks = new Map<
    string,
    {
      id: string;
      title: string;
      status: string;
      priority: string | null;
      number: number | null;
      projectId: string;
      userId: string | null;
      assigneeName: string | null;
    }
  >();

  if (taskIds.size > 0) {
    const taskRows = yield* database.query((db) =>
      db
        .select({
          id: taskTable.id,
          title: taskTable.title,
          status: taskTable.status,
          priority: taskTable.priority,
          number: taskTable.number,
          projectId: taskTable.projectId,
          userId: taskTable.userId,
          assigneeName: userTable.name,
        })
        .from(taskTable)
        .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
        .leftJoin(userTable, eq(taskTable.userId, userTable.id))
        .where(
          and(
            inArray(taskTable.id, [...taskIds]),
            eq(projectTable.workspaceId, workspaceId),
          ),
        ),
    );

    for (const task of taskRows) {
      tasks.set(task.id, task);
    }
  }

  return relations
    .filter((rel) => tasks.has(rel.sourceTaskId) && tasks.has(rel.targetTaskId))
    .map((rel) => ({
      ...rel,
      sourceTask: tasks.get(rel.sourceTaskId) ?? null,
      targetTask: tasks.get(rel.targetTaskId) ?? null,
    }));
});

export default getTaskRelations;
