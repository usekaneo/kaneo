/**
 * Personal positions to write so `taskId` sorts where it sits in `visibleIds`
 * (the lane as the user saw it after the drop). Placed tasks sort by position
 * before unplaced ones, so only the moved task changes unless it lands among
 * unplaced tasks; those above it are then placed too. Tasks hidden by filters
 * or later pages are never rewritten.
 */
export function placeInOrder(
  visibleIds: readonly string[],
  taskId: string,
  positions: ReadonlyMap<string, number>,
): Map<string, number> {
  const index = visibleIds.indexOf(taskId);
  if (index < 0) return new Map();
  const above = visibleIds[index - 1];
  const below = visibleIds[index + 1];
  const abovePosition = above === undefined ? undefined : positions.get(above);
  const belowPosition = below === undefined ? undefined : positions.get(below);

  if (above === undefined)
    return new Map([
      [taskId, belowPosition === undefined ? 0 : belowPosition - 1],
    ]);
  if (abovePosition !== undefined)
    return new Map([
      [
        taskId,
        belowPosition === undefined
          ? abovePosition + 1
          : (abovePosition + belowPosition) / 2,
      ],
    ]);

  // Dropped below unplaced tasks: place the unplaced run above it, in order,
  // after the last placed task.
  let start = index - 1;
  while (start > 0 && !positions.has(visibleIds[start - 1] as string)) start--;
  const before =
    start > 0 ? positions.get(visibleIds[start - 1] as string) : undefined;
  let next = before === undefined ? 0 : before + 1;
  const writes = new Map<string, number>();
  for (const id of visibleIds.slice(start, index)) writes.set(id, next++);
  writes.set(taskId, next);
  return writes;
}
