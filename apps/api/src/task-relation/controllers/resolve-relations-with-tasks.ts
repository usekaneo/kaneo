import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import { projectTable, taskTable, userTable } from "../../database/schema";

type RelationRow = {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
  createdAt: Date;
};

type TaskSummary = {
  id: string;
  title: string;
  status: string;
  priority: string | null;
  number: number | null;
  projectId: string;
  projectName: string;
  projectSlug: string;
  userId: string | null;
  assigneeName: string | null;
  startDate: Date | null;
  dueDate: Date | null;
  isMilestone: boolean;
};

// Shared by every task-relation read: expands relation rows with a summary of
// each linked task, and drops relations whose source or target is not visible
// in the caller's workspace (a legacy cross-workspace row, or a task the
// caller otherwise cannot see).
async function resolveRelationsWithTasks(
  relations: RelationRow[],
  workspaceId: string,
) {
  const taskIds = new Set<string>();
  for (const rel of relations) {
    taskIds.add(rel.sourceTaskId);
    taskIds.add(rel.targetTaskId);
  }

  const tasks = new Map<string, TaskSummary>();

  if (taskIds.size > 0) {
    const taskRows = await db
      .select({
        id: taskTable.id,
        title: taskTable.title,
        status: taskTable.status,
        priority: taskTable.priority,
        number: taskTable.number,
        projectId: taskTable.projectId,
        projectName: projectTable.name,
        projectSlug: projectTable.slug,
        userId: taskTable.userId,
        assigneeName: userTable.name,
        startDate: taskTable.startDate,
        dueDate: taskTable.dueDate,
        isMilestone: taskTable.isMilestone,
      })
      .from(taskTable)
      .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
      .leftJoin(userTable, eq(taskTable.userId, userTable.id))
      .where(
        and(
          inArray(taskTable.id, [...taskIds]),
          eq(projectTable.workspaceId, workspaceId),
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
}

export default resolveRelationsWithTasks;
