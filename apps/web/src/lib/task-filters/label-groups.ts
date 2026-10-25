export type FilterLabel = { id: string; name: string; color: string };

export const labelGroupKey = (label: FilterLabel) =>
  JSON.stringify([label.name, label.color.toLowerCase()]);

export function groupLabels(labels: FilterLabel[]): FilterLabel[] {
  const seen = new Set<string>();
  return labels.filter((label) => {
    const key = labelGroupKey(label);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function isLabelGroupSelected(
  labels: FilterLabel[],
  group: FilterLabel,
  selected: string[] | null | undefined,
) {
  const key = labelGroupKey(group);
  const selectedIds = new Set(selected);
  return labels.some(
    (label) => selectedIds.has(label.id) && labelGroupKey(label) === key,
  );
}

export function toggleLabelGroup(
  labels: FilterLabel[],
  group: FilterLabel,
  selected: string[] | null | undefined,
): string[] | null {
  const key = labelGroupKey(group);
  const groupIds = new Set(
    labels
      .filter((label) => labelGroupKey(label) === key)
      .map((label) => label.id),
  );
  const current = selected ?? [];
  const selectedIds = new Set(current);
  const next = current.some((id) => groupIds.has(id))
    ? current.filter((id) => !groupIds.has(id))
    : [...current, ...[...groupIds].filter((id) => !selectedIds.has(id))];
  return next.length > 0 ? next : null;
}

export function expandLabelFilter(
  labels: FilterLabel[],
  selected: string[] | null,
): string[] | null {
  if (!selected?.length) return selected;
  const selectedIds = new Set(selected);
  const selectedGroups = new Set(
    labels.filter((label) => selectedIds.has(label.id)).map(labelGroupKey),
  );
  for (const label of labels) {
    if (selectedGroups.has(labelGroupKey(label))) selectedIds.add(label.id);
  }
  return [...selectedIds];
}
