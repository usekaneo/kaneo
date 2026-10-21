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
