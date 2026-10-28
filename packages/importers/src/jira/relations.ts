import type { ImportedRelation, ImportedRelationType } from "../types.js";
import type { JiraIssue, JiraIssueLink } from "./api-types.js";

export type RelationsResult = {
  relations: ImportedRelation[];
  external: number;
};

export function mapRelations(issues: JiraIssue[]): RelationsResult {
  const issueIds = new Set(issues.map((issue) => issue.id));
  const seen = new Set<string>();
  const external = new Set<string>();
  const relations: ImportedRelation[] = [];

  function add(
    sourceKey: string | undefined,
    targetKey: string | undefined,
    type: ImportedRelationType,
  ): void {
    if (!sourceKey || !targetKey || sourceKey === targetKey) return;
    const pair =
      type === "related"
        ? [sourceKey, targetKey].sort().join(":")
        : `${sourceKey}:${targetKey}`;
    const id = `${type}:${pair}`;
    if (!issueIds.has(sourceKey) || !issueIds.has(targetKey)) {
      external.add(id);
      return;
    }
    if (seen.has(id)) return;
    seen.add(id);
    relations.push({ sourceKey, targetKey, type });
  }

  for (const issue of issues) {
    add(issue.fields?.parent?.id, issue.id, "subtask");
    for (const link of issue.fields?.issuelinks ?? []) {
      const blocks = isBlocksLink(link);
      if (link.outwardIssue) {
        add(issue.id, link.outwardIssue.id, blocks ? "blocks" : "related");
      }
      if (link.inwardIssue) {
        add(link.inwardIssue.id, issue.id, blocks ? "blocks" : "related");
      }
    }
  }

  return { relations, external: external.size };
}

export function isBlocksLink(link: JiraIssueLink): boolean {
  const name = link.type?.name?.trim().toLowerCase();
  const outward = link.type?.outward?.trim().toLowerCase();
  return name === "blocks" || outward === "blocks";
}
