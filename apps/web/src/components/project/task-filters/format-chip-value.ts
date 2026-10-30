export function formatChipValue(
  labels: string[],
  selectedCount: (count: number) => string,
) {
  return labels.length <= 2 ? labels.join(", ") : selectedCount(labels.length);
}
