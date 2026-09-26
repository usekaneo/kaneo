import { and, eq, inArray } from "drizzle-orm";
import db from "../../database";
import {
  projectTable,
  taskRelationTable,
  taskTable,
} from "../../database/schema";

// Both "blocks" (sourceTaskId blocks targetTaskId) and "subtask" (sourceTaskId
// is the parent, targetTaskId the child) are directional graphs where a cycle
// is a real modeling error: a task scheduled to depend on its own completion,
// or a task nested inside its own descendant. "related" has no direction and
// no cycle concept, so callers only invoke this for those two types.
//
// Adding a new source->target edge closes a cycle exactly when target can
// already reach source by following existing edges of the same relationType.
// Scoped strictly to the workspace's own tasks, so a legacy or otherwise
// foreign-workspace relation can never be traversed into or out of.
export async function wouldCreateCycle({
  workspaceId,
  relationType,
  sourceTaskId,
  targetTaskId,
}: {
  workspaceId: string;
  relationType: string;
  sourceTaskId: string;
  targetTaskId: string;
}): Promise<boolean> {
  const workspaceTasks = db
    .select({ id: taskTable.id })
    .from(taskTable)
    .innerJoin(projectTable, eq(taskTable.projectId, projectTable.id))
    .where(eq(projectTable.workspaceId, workspaceId));

  const edges = await db
    .select({
      sourceTaskId: taskRelationTable.sourceTaskId,
      targetTaskId: taskRelationTable.targetTaskId,
    })
    .from(taskRelationTable)
    .where(
      and(
        eq(taskRelationTable.relationType, relationType),
        inArray(taskRelationTable.sourceTaskId, workspaceTasks),
        inArray(taskRelationTable.targetTaskId, workspaceTasks),
      ),
    );

  const adjacency = new Map<string, string[]>();
  for (const edge of edges) {
    const children = adjacency.get(edge.sourceTaskId);
    if (children) {
      children.push(edge.targetTaskId);
    } else {
      adjacency.set(edge.sourceTaskId, [edge.targetTaskId]);
    }
  }

  // BFS from targetTaskId looking for sourceTaskId along existing edges.
  const queue: string[] = [targetTaskId];
  const visited = new Set<string>([targetTaskId]);
  while (queue.length > 0) {
    // biome-ignore lint/style/noNonNullAssertion: bounded by the while condition
    const current = queue.shift()!;
    if (current === sourceTaskId) {
      return true;
    }
    for (const next of adjacency.get(current) ?? []) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return false;
}
