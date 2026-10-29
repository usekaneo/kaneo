import type { SearchResult, TaskRelation } from "@/lib/api/types";

export type LinkKind = "related" | "blocks" | "parent";

/** The relation that links a task as its parent: the parent is the source of a `subtask` link. */
export function parentRelation(taskId: string, relations: TaskRelation[]) {
  return relations.find(
    (r) => r.relationType === "subtask" && r.targetTaskId === taskId,
  );
}

/**
 * The relation to create when picking `pickedId`. A task has one parent, like on the web, so a new
 * parent also names the old parent link to remove afterwards.
 */
export function relationLink(
  kind: LinkKind,
  taskId: string,
  pickedId: string,
  relations: TaskRelation[],
) {
  if (kind !== "parent")
    return { sourceTaskId: taskId, targetTaskId: pickedId, relationType: kind };
  return {
    sourceTaskId: pickedId,
    targetTaskId: taskId,
    relationType: "subtask",
    replaces: parentRelation(taskId, relations)?.id,
  };
}

/**
 * Search results that can be linked. Parents come from the task's own project, as on the web, and
 * can't be the current parent or one of its subtasks, which would make a loop.
 */
export function linkCandidates(
  results: SearchResult[],
  kind: LinkKind,
  taskId: string,
  projectId: string | undefined,
  relations: TaskRelation[],
) {
  const others = results.filter((r) => r.id !== taskId);
  if (kind !== "parent") return others;
  const excluded = new Set(
    relations
      .filter((r) => r.relationType === "subtask")
      .map((r) =>
        r.sourceTaskId === taskId ? r.targetTaskId : r.sourceTaskId,
      ),
  );
  return others.filter((r) => r.projectId === projectId && !excluded.has(r.id));
}
