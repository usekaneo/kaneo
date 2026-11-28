type ProjectColumn = {
  slug: string;
  name: string;
  icon: string | null;
  isFinal: boolean;
  position: number;
};

type MergedColumn = {
  slug: string;
  name: string;
  nameCounts: Map<string, number>;
  icon: string | null;
  isFinal: boolean;
  minPosition: number;
};

/**
 * One lane per column slug across projects. `taskStatuses` adds a lane for a
 * status no project defines a column for, so no task is hidden.
 */
export function mergeColumns(
  columns: ProjectColumn[],
  taskStatuses: string[] = [],
) {
  const merged = new Map<string, MergedColumn>();
  for (const column of columns) {
    const existing = merged.get(column.slug);
    if (!existing) {
      merged.set(column.slug, {
        slug: column.slug,
        name: column.name,
        nameCounts: new Map([[column.name, 1]]),
        icon: column.icon,
        isFinal: column.isFinal,
        minPosition: column.position,
      });
      continue;
    }
    existing.nameCounts.set(
      column.name,
      (existing.nameCounts.get(column.name) ?? 0) + 1,
    );
    // The most common name wins; ties keep the first one seen.
    if (
      (existing.nameCounts.get(column.name) ?? 0) >
      (existing.nameCounts.get(existing.name) ?? 0)
    ) {
      existing.name = column.name;
    }
    existing.icon ??= column.icon;
    existing.isFinal ||= column.isFinal;
    existing.minPosition = Math.min(existing.minPosition, column.position);
  }
  const lanes = [...merged.values()].sort((left, right) =>
    left.minPosition !== right.minPosition
      ? left.minPosition - right.minPosition
      : left.slug.localeCompare(right.slug),
  );
  for (const status of taskStatuses) {
    if (merged.has(status)) continue;
    const lane = {
      slug: status,
      name: status,
      nameCounts: new Map(),
      icon: null,
      isFinal: false,
      minPosition: Number.MAX_SAFE_INTEGER,
    };
    merged.set(status, lane);
    lanes.push(lane);
  }
  return lanes.map(({ slug, name, icon, isFinal }) => ({
    slug,
    name,
    icon,
    isFinal,
  }));
}
