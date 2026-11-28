const MAX_COLUMNS = 4;

export function layoutColumns(count: number): number {
  if (count <= MAX_COLUMNS) return Math.max(count, 1);
  const rows = Math.ceil(count / MAX_COLUMNS);
  return Math.ceil(count / rows);
}
