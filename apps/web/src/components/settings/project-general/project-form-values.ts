export type ProjectFormValues = {
  name: string;
  slug: string;
  description?: string;
  icon: string;
  includeSubtasks?: boolean;
};

export type NormalizedProjectValues = {
  name: string;
  slug: string;
  description: string;
  icon: string;
  includeSubtasks?: boolean;
};

export type ProjectFieldChanges = Record<
  keyof NormalizedProjectValues,
  boolean
>;

export function normalizeProjectValues(
  data: ProjectFormValues,
): NormalizedProjectValues {
  return {
    name: data.name.trim(),
    slug: data.slug.trim(),
    description: (data.description ?? "").trim(),
    icon: data.icon || "Layout",
    includeSubtasks: data.includeSubtasks ?? true,
  };
}

export function getProjectFieldChanges(
  last: NormalizedProjectValues | null,
  next: NormalizedProjectValues,
): ProjectFieldChanges {
  return {
    name: last?.name !== next.name,
    slug: last?.slug !== next.slug,
    description: last?.description !== next.description,
    icon: last?.icon !== next.icon,
    includeSubtasks:
      (last?.includeSubtasks ?? true) !== (next.includeSubtasks ?? true),
  };
}

export function hasProjectFieldChanges(changes: ProjectFieldChanges) {
  return Object.values(changes).some(Boolean);
}
