import type { ImportedRelation, ImportedRelationType } from "../types.js";
import type { LinearIssue } from "./client.js";

const RELATION_TYPES: Record<string, ImportedRelationType> = {
  blocks: "blocks",
  related: "related",
  similar: "related",
  duplicate: "related",
};

export function mapRelations(issues: LinearIssue[]): ImportedRelation[] {
  const issueIds = new Set(issues.map((issue) => issue.id));
  const seen = new Set<string>();
  const relations: ImportedRelation[] = [];

  function add(
    sourceKey: string,
    targetKey: string,
    type: ImportedRelationType,
  ): void {
    if (sourceKey === targetKey) return;
    if (!issueIds.has(sourceKey) || !issueIds.has(targetKey)) return;
    const pair =
      type === "related"
        ? [sourceKey, targetKey].sort().join(":")
        : `${sourceKey}:${targetKey}`;
    const id = `${type}:${pair}`;
    if (seen.has(id)) return;
    seen.add(id);
    relations.push({ sourceKey, targetKey, type });
  }

  for (const issue of issues) {
    if (issue.parent) add(issue.parent.id, issue.id, "subtask");
    for (const relation of issue.relations.nodes) {
      const type = RELATION_TYPES[relation.type];
      if (type && relation.relatedIssue) {
        add(issue.id, relation.relatedIssue.id, type);
      }
    }
  }

  return relations;
}
