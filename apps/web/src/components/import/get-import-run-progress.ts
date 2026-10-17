import type { ImportRun } from "@/fetchers/import/get-import-run";

export type ImportRunProgress = {
  total: number;
  completed: number;
  failed: number;
  finished: number;
  current: number;
  percent: number;
  warnings: number;
  failedNames: string[];
};

export type ImportRunOutcome =
  | "running"
  | "imported"
  | "warnings"
  | "partial"
  | "failed";

export function getImportRunProgress(
  projects: Pick<
    ImportRun["projects"][number],
    "name" | "status" | "warnings"
  >[],
): ImportRunProgress {
  const total = projects.length;
  const completed = projects.filter(
    (project) => project.status === "completed",
  ).length;
  const failedNames = projects
    .filter((project) => project.status === "failed")
    .map((project) => project.name);
  const finished = completed + failedNames.length;
  const warnings = projects.reduce(
    (sum, project) =>
      project.status === "completed" ? sum + project.warnings.length : sum,
    0,
  );

  return {
    total,
    completed,
    failed: failedNames.length,
    finished,
    current: Math.min(finished + 1, total),
    percent: total === 0 ? 0 : Math.round((finished / total) * 100),
    warnings,
    failedNames,
  };
}

export function getImportRunOutcome(
  run: Pick<ImportRun, "status" | "projects">,
): ImportRunOutcome {
  if (run.status === "running") return "running";

  const progress = getImportRunProgress(run.projects);
  if (progress.completed === 0) return "failed";
  if (progress.completed < progress.total || run.status === "failed") {
    return "partial";
  }
  if (progress.warnings > 0) return "warnings";
  return "imported";
}
