import type { ImportedLabel } from "../types.js";
import type { JiraIssue } from "./api-types.js";

export const LABEL_PALETTE = [
  "#8b5cf6",
  "#059669",
  "#16a34a",
  "#d97706",
  "#ea580c",
  "#e11d48",
  "#dc2626",
  "#64748b",
] as const;

export function labelColor(name: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < name.length; index++) {
    hash ^= name.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return LABEL_PALETTE[hash % LABEL_PALETTE.length] as string;
}

export function issueLabels(issue: JiraIssue): string[] {
  const labels = (issue.fields?.labels ?? [])
    .filter((label): label is string => typeof label === "string")
    .map((label) => label.trim())
    .filter(Boolean);
  return [...new Set(labels)];
}

export function mapLabels(issues: JiraIssue[]): ImportedLabel[] {
  const names = new Set(issues.flatMap(issueLabels));
  return [...names]
    .sort((a, b) => a.localeCompare(b))
    .map((name) => ({ key: name, name, color: labelColor(name) }));
}
