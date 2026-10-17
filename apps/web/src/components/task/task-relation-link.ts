import type { RelationPickerMode } from "./task-relation-picker-store";

type RelationEdge = {
  id: string;
  sourceTaskId: string;
  targetTaskId: string;
  relationType: string;
};

export function buildRelationLink(
  mode: RelationPickerMode,
  taskId: string,
  pickedTaskId: string,
) {
  if (mode === "parent") {
    return {
      sourceTaskId: pickedTaskId,
      targetTaskId: taskId,
      relationType: "subtask" as const,
    };
  }
  if (mode === "blockedBy") {
    return {
      sourceTaskId: pickedTaskId,
      targetTaskId: taskId,
      relationType: "blocks" as const,
    };
  }
  return {
    sourceTaskId: taskId,
    targetTaskId: pickedTaskId,
    relationType: mode,
  };
}

export function findParentRelation(taskId: string, relations: RelationEdge[]) {
  return relations.find(
    (relation) =>
      relation.relationType === "subtask" && relation.targetTaskId === taskId,
  );
}

export function unpickableTaskIds(
  mode: RelationPickerMode,
  taskId: string,
  relations: RelationEdge[],
) {
  const ids = new Set([taskId]);
  for (const relation of relations) {
    const isSubtask = relation.relationType === "subtask";
    if (mode === "parent" ? isSubtask : !isSubtask) {
      ids.add(relation.sourceTaskId);
      ids.add(relation.targetTaskId);
    }
  }
  return ids;
}
