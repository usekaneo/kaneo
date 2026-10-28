import type { ProjectAccessValue } from "./project-access-value";

export function isProjectAccessComplete(value: ProjectAccessValue): boolean {
  return value.projectAccess === "all" || value.projectIds.length > 0;
}
