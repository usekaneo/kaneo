import type { SourceProject } from "@kaneo/importers";
import { HTTPException } from "hono/http-exception";
import {
  type ImportRunProject,
  pendingRunProject,
} from "../import-run-project";

export function selectSourceProjects(
  projectIds: readonly string[],
  available: readonly SourceProject[],
  sourceName: string,
): ImportRunProject[] {
  const byId = new Map(available.map((project) => [project.id, project]));
  const missing = projectIds.filter((id) => !byId.has(id));

  if (missing.length > 0) {
    const subject =
      missing.length === 1
        ? "A selected project is"
        : `${missing.length} selected projects are`;
    throw new HTTPException(400, {
      message: `${subject} no longer available in ${sourceName}. Refresh the list and try again.`,
    });
  }

  return projectIds.map((id) =>
    pendingRunProject(id, byId.get(id)?.name.trim() || "Untitled project"),
  );
}
