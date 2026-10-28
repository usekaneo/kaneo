export function applyOrder<T extends { id: string }>(
  items: T[],
  ids: string[] | null,
): T[] {
  if (!ids) return items;

  const rank = new Map(ids.map((id, index) => [id, index]));
  return [...items].sort(
    (a, b) =>
      (rank.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
      (rank.get(b.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function moveItem<T>(items: T[], from: number, to: number): T[] {
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return items;
  next.splice(to, 0, moved);
  return next;
}

export function toPositions(items: Array<{ id: string }>) {
  return items.map((item, position) => ({ id: item.id, position }));
}
