import type { Column, Project } from "../api/schemas.js";
import { projectUrl } from "../render/links.js";

export type ColumnCountJson = {
  readonly slug: string;
  readonly name: string;
  readonly isFinal: boolean;
  readonly taskCount: number;
};

export type ProjectViewJson = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly description: string | null;
  readonly url: string;
  readonly columns: ReadonlyArray<ColumnCountJson>;
  readonly totalTasks: number;
};

export function countByColumn(
  columns: ReadonlyArray<Column>,
  tasks: ReadonlyArray<{ readonly status: string }>,
): ColumnCountJson[] {
  const counts = new Map<string, number>();
  for (const task of tasks)
    counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
  return [...columns]
    .sort((a, b) => a.position - b.position)
    .map((column) => ({
      slug: column.slug,
      name: column.name,
      isFinal: column.isFinal,
      taskCount: counts.get(column.slug) ?? 0,
    }));
}

export function toProjectView(
  project: Project,
  columns: ReadonlyArray<Column>,
  board: {
    readonly tasks: ReadonlyArray<{ readonly status: string }>;
    readonly total: number;
  },
  webUrl: string,
): ProjectViewJson {
  return {
    id: project.id,
    key: project.slug.toUpperCase(),
    name: project.name,
    description: project.description,
    url: projectUrl(webUrl, project),
    columns: countByColumn(columns, board.tasks),
    totalTasks: board.total,
  };
}
