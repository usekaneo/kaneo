export function getSelectableTaskColumns<T extends { slug: string }>(
  columns: T[] | undefined,
): T[] {
  const counts = new Map<string, number>();
  for (const column of columns ?? []) {
    counts.set(column.slug, (counts.get(column.slug) ?? 0) + 1);
  }
  // Creation accepts slugs, so an ambiguous legacy slug cannot pick a column.
  return (columns ?? []).filter((column) => counts.get(column.slug) === 1);
}
