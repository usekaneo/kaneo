import type { ImportRunProject } from "@/fetchers/import/get-import-run";

export type ImportCounts = ImportRunProject["counts"];

export type ImportCountKey = "tasks" | "columns" | "labels" | "comments";

export type ImportCountPart = { key: ImportCountKey; count: number };

export const PROJECT_COUNT_KEYS: ImportCountKey[] = [
  "tasks",
  "columns",
  "labels",
  "comments",
];

export const TOTAL_COUNT_KEYS: ImportCountKey[] = [
  "tasks",
  "comments",
  "labels",
];

export const IMPORT_COUNT_LABEL_KEYS: Record<ImportCountKey, string> = {
  tasks: "settings:workspaceImport.counts.tasks",
  columns: "settings:workspaceImport.counts.columns",
  labels: "settings:workspaceImport.counts.labels",
  comments: "settings:workspaceImport.counts.comments",
};

export function summarizeImportCounts(
  counts: ImportCounts,
  keys: ImportCountKey[] = PROJECT_COUNT_KEYS,
): ImportCountPart[] {
  return keys
    .map((key) => ({ key, count: counts[key] }))
    .filter((part) => part.count > 0);
}

export function sumImportCounts(
  projects: Pick<ImportRunProject, "status" | "counts">[],
): ImportCounts {
  const total: ImportCounts = {
    columns: 0,
    tasks: 0,
    labels: 0,
    comments: 0,
    assignees: 0,
    relations: 0,
  };

  for (const project of projects) {
    if (project.status !== "completed") continue;
    for (const key of Object.keys(total) as (keyof ImportCounts)[]) {
      total[key] += project.counts[key];
    }
  }

  return total;
}
