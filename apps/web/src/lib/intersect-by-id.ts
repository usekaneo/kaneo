export function intersectById<T extends { id: string }>(
  lists: readonly (readonly T[])[],
): T[] {
  const [first, ...rest] = lists;
  if (!first) return [];
  const others = rest.map((list) => new Set(list.map((item) => item.id)));
  return first.filter((item) => others.every((ids) => ids.has(item.id)));
}
