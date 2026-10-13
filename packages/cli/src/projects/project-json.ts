import type { ProjectSummary } from "../api/project-summaries.js";
import { projectUrl } from "../render/links.js";

export type ProjectJson = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
  readonly slug: string;
  readonly workspaceId: string;
  readonly archived: boolean;
  readonly totalTasks: number;
  readonly completion: number;
  readonly dueDate: string | null;
  readonly url: string;
};

export function toProjectJson(
  project: ProjectSummary,
  webUrl: string,
): ProjectJson {
  return {
    id: project.id,
    key: project.slug.toUpperCase(),
    name: project.name,
    slug: project.slug,
    workspaceId: project.workspaceId,
    archived: project.archivedAt !== null,
    totalTasks: project.statistics.totalTasks,
    completion: project.statistics.completionPercentage,
    dueDate: project.statistics.dueDate,
    url: projectUrl(webUrl, project),
  };
}
