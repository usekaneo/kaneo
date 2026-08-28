import type { GitlabProject } from "./gitlab-api";

// GitLab role levels: Guest 10, Reporter 20, Developer 30, Maintainer 40,
// Owner 50. Kaneo creates its own `priority:` and `status:` labels, which
// needs Developer.
export const REQUIRED_ACCESS_LEVEL = 30;

export const REQUIRED_ACCESS_LABEL = "Developer role or higher";

export function highestAccessLevel(
  permissions: GitlabProject["permissions"],
): number {
  return Math.max(
    permissions?.project_access?.access_level ?? 0,
    permissions?.group_access?.access_level ?? 0,
  );
}

export function hasRequiredAccess(project: GitlabProject): boolean {
  return highestAccessLevel(project.permissions) >= REQUIRED_ACCESS_LEVEL;
}
