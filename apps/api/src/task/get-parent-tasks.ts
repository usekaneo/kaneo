import { and, asc, eq, inArray } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { projectTable, taskRelationTable, taskTable } from "../database/schema";
import { projectAccessCondition } from "../project-access/project-access-condition";
import type defaultDb from "../database";
import type { TaskReadDatabase } from "./bounded-read";

export type ParentTask = {
  id: string;
  number: number | null;
  title: string;
  projectSlug: string;
};

/**
 * Each subtask's parent for card badges, with the same visibility as subtask
 * counts: same workspace, public projects on public boards, and only projects
 * the caller can open.
 */
export async function getParentTasks(
  db: TaskReadDatabase | typeof defaultDb,
  taskIds: string[],
  workspaceId: string,
  publicOnly: boolean,
  userId?: string,
) {
  const parents = new Map<string, ParentTask>();
  if (taskIds.length === 0) return parents;

  const parent = alias(taskTable, "parent_task");
  const rows = await db
    .select({
      childId: taskRelationTable.targetTaskId,
      id: parent.id,
      number: parent.number,
      title: parent.title,
      projectSlug: projectTable.slug,
    })
    .from(taskRelationTable)
    .innerJoin(parent, eq(taskRelationTable.sourceTaskId, parent.id))
    .innerJoin(projectTable, eq(parent.projectId, projectTable.id))
    .where(
      and(
        inArray(taskRelationTable.targetTaskId, taskIds),
        eq(taskRelationTable.relationType, "subtask"),
        eq(projectTable.workspaceId, workspaceId),
        publicOnly ? eq(projectTable.isPublic, true) : undefined,
        userId ? projectAccessCondition(userId, projectTable.id) : undefined,
      ),
    )
    .orderBy(asc(taskRelationTable.createdAt), asc(taskRelationTable.id));

  // A task has one parent; should old data hold several, the first one wins.
  for (const { childId, ...row } of rows)
    if (!parents.has(childId)) parents.set(childId, row);
  return parents;
}
