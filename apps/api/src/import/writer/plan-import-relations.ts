import type { ImportedRelation } from "@kaneo/importers";

export type PlannedImportRelation = {
  sourceTaskId: string;
  targetTaskId: string;
  relationType: ImportedRelation["type"];
};

const RELATION_TYPES = new Set<string>(["subtask", "blocks", "related"]);

export function planImportRelations(
  relations: readonly ImportedRelation[],
  taskIds: ReadonlyMap<string, string>,
): PlannedImportRelation[] {
  const seen = new Set<string>();
  const planned: PlannedImportRelation[] = [];

  for (const relation of relations) {
    if (!RELATION_TYPES.has(relation.type)) continue;
    const sourceTaskId = taskIds.get(relation.sourceKey);
    const targetTaskId = taskIds.get(relation.targetKey);
    if (!sourceTaskId || !targetTaskId || sourceTaskId === targetTaskId) {
      continue;
    }

    const pair = [sourceTaskId, targetTaskId].sort().join(":");
    const identity = `${relation.type}:${pair}`;
    if (seen.has(identity)) continue;
    seen.add(identity);

    planned.push({ sourceTaskId, targetTaskId, relationType: relation.type });
  }

  return planned;
}
