import type {
  ProjectRecord,
  ProjectStatistics,
} from "../api/project-writes.js";
import { type ProjectJson, toProjectJson } from "../projects/project-json.js";

export type ProjectRecordJson = ProjectJson & {
  readonly description: string | null;
  readonly icon: string | null;
  readonly isPublic: boolean;
};

export const EMPTY_STATISTICS: ProjectStatistics = {
  totalTasks: 0,
  completionPercentage: 0,
  dueDate: null,
};

export function toProjectRecordJson(
  project: ProjectRecord,
  statistics: ProjectStatistics,
  webUrl: string,
): ProjectRecordJson {
  return {
    ...toProjectJson({ ...project, statistics }, webUrl),
    description: project.description,
    icon: project.icon,
    isPublic: project.isPublic ?? false,
  };
}
