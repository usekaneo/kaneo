export const PROJECT_TYPE_KEYS = [
  "development",
  "maintenance",
  "support",
  "hr",
  "marketing",
  "operations",
] as const;

export type ProjectTypeKey = (typeof PROJECT_TYPE_KEYS)[number];

export const DEFAULT_PROJECT_TYPE: ProjectTypeKey = "development";

export function isProjectTypeKey(value: string): value is ProjectTypeKey {
  return (PROJECT_TYPE_KEYS as readonly string[]).includes(value);
}
