export type FilterLabel = { id: string; name: string; color: string };

const sameGroup = (left: FilterLabel, right: FilterLabel) =>
  left.name === right.name && left.color === right.color;

export function groupLabels(labels: FilterLabel[]): FilterLabel[] {
  return labels.filter(
    (label, index) =>
      labels.findIndex((other) => sameGroup(other, label)) === index,
  );
}

export function isLabelGroupSelected(
  labels: FilterLabel[],
  group: FilterLabel,
  selected: string[] | null | undefined,
) {
  return labels.some(
    (label) => sameGroup(label, group) && (selected ?? []).includes(label.id),
  );
}

export function toggleLabelGroup(
  labels: FilterLabel[],
  group: FilterLabel,
  selected: string[] | null | undefined,
): string[] | null {
  const groupIds = labels
    .filter((label) => sameGroup(label, group))
    .map((label) => label.id);
  const current = selected ?? [];
  const next = isLabelGroupSelected(labels, group, current)
    ? current.filter((id) => !groupIds.includes(id))
    : [...current, ...groupIds.filter((id) => !current.includes(id))];
  return next.length > 0 ? next : null;
}

export function expandLabelFilter(
  labels: FilterLabel[],
  selected: string[] | null,
): string[] | null {
  if (!selected?.length) return selected;
  const selectedIds = new Set(selected);
  const groupKey = (label: FilterLabel) =>
    JSON.stringify([label.name, label.color]);
  const selectedGroups = new Set(
    labels.filter((label) => selectedIds.has(label.id)).map(groupKey),
  );
  for (const label of labels) {
    if (selectedGroups.has(groupKey(label))) selectedIds.add(label.id);
  }
  return [...selectedIds];
}

// Keep one selected ID per label group; matching expands it against live labels.
// Unknown IDs remain filters rather than silently widening the saved result.
export function compactLabelFilter(
  labels: FilterLabel[],
  selected: string[] | null,
): string[] | null {
  if (!selected?.length) return selected;
  const byId = new Map(labels.map((label) => [label.id, label]));
  const seen = new Set<string>();
  return selected.filter((id) => {
    const label = byId.get(id);
    const key = label
      ? JSON.stringify(["group", label.name, label.color])
      : JSON.stringify(["id", id]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
