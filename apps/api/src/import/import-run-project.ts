export const IMPORT_RUN_STATUSES = ["running", "completed", "failed"] as const;

export type ImportRunStatus = (typeof IMPORT_RUN_STATUSES)[number];

export const IMPORT_RUN_PROJECT_STATUSES = [
  "pending",
  "running",
  "completed",
  "failed",
] as const;

export type ImportRunProjectStatus =
  (typeof IMPORT_RUN_PROJECT_STATUSES)[number];

export type ImportCounts = {
  columns: number;
  tasks: number;
  labels: number;
  comments: number;
  assignees: number;
  relations: number;
};

export type ImportRunProject = {
  sourceId: string;
  name: string;
  status: ImportRunProjectStatus;
  projectId: string | null;
  projectSlug: string | null;
  counts: ImportCounts;
  warnings: string[];
  error: string | null;
};

export const EMPTY_IMPORT_COUNTS: ImportCounts = {
  columns: 0,
  tasks: 0,
  labels: 0,
  comments: 0,
  assignees: 0,
  relations: 0,
};

export function pendingRunProject(
  sourceId: string,
  name: string,
): ImportRunProject {
  return {
    sourceId,
    name,
    status: "pending",
    projectId: null,
    projectSlug: null,
    counts: { ...EMPTY_IMPORT_COUNTS },
    warnings: [],
    error: null,
  };
}

export function failUnfinishedProjects(
  projects: ImportRunProject[],
  error: string,
): ImportRunProject[] {
  return projects.map((project) =>
    project.status === "pending" || project.status === "running"
      ? { ...project, status: "failed", error }
      : project,
  );
}
