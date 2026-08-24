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
