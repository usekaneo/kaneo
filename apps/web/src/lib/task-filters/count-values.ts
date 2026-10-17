export function countValues<T>(
  items: T[],
  pick: (item: T) => Array<string | null | undefined>,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const item of items) {
    for (const value of new Set(pick(item))) {
      if (value) counts[value] = (counts[value] ?? 0) + 1;
    }
  }
  return counts;
}
