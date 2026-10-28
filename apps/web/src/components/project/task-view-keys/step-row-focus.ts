import type { FocusDirection, TaskGroup } from "./task-groups";

export function stepRowFocus(
  groups: TaskGroup[],
  taskId: string | null,
  rowId: string | null | undefined,
  direction: FocusDirection,
) {
  if (direction === "left" || direction === "right") return null;
  const rows = groups
    .filter((group) => !group.collapsed)
    .flatMap((group) => group.rows ?? []);
  if (rows.length === 0) return null;
  let index = rowId ? rows.findIndex((row) => row.rowId === rowId) : -1;
  if (index === -1 && taskId) {
    index = rows.findIndex((row) => row.taskId === taskId);
  }
  if (index === -1) return direction === "down" ? rows[0] : rows.at(-1);
  const next = direction === "down" ? index + 1 : index - 1;
  return rows[Math.min(Math.max(next, 0), rows.length - 1)];
}
