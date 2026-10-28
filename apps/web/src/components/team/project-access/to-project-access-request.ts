import {
  ALL_PROJECTS_ACCESS,
  type ProjectAccessValue,
} from "./project-access-value";

export function toProjectAccessRequest(
  value: ProjectAccessValue,
  availableProjectIds: readonly string[],
): ProjectAccessValue {
  if (value.projectAccess === "all") return ALL_PROJECTS_ACCESS;
  const available = new Set(availableProjectIds);
  return {
    projectAccess: "selected",
    projectIds: [...new Set(value.projectIds)].filter((id) =>
      available.has(id),
    ),
  };
}
