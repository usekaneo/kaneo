export function findRemovedProjectIds(
  before: readonly { id: string }[] | undefined,
  after: readonly { id: string }[] | undefined,
) {
  if (!before || !after) return [];
  const remaining = new Set(after.map((project) => project.id));
  return [...new Set(before.map((project) => project.id))].filter(
    (id) => !remaining.has(id),
  );
}
