export const PROJECT_ACCESS_MODES = ["all", "selected"] as const;

export type ProjectAccessMode = (typeof PROJECT_ACCESS_MODES)[number];

export function isProjectAccessMode(
  value: unknown,
): value is ProjectAccessMode {
  return PROJECT_ACCESS_MODES.includes(value as ProjectAccessMode);
}
