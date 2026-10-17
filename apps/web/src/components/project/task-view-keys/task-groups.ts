export type TaskGroup = {
  id: string;
  taskIds: string[];
  collapsed?: boolean;
};

export type TaskLayout = "board" | "list";
export type FocusDirection = "up" | "down" | "left" | "right";
export type MoveDirection = "up" | "down" | "top" | "bottom" | "left" | "right";

export function findTaskGroup(groups: TaskGroup[], taskId: string | null) {
  if (!taskId) return null;
  const groupIndex = groups.findIndex((group) =>
    group.taskIds.includes(taskId),
  );
  if (groupIndex === -1) return null;
  return {
    group: groups[groupIndex],
    groupIndex,
    index: groups[groupIndex].taskIds.indexOf(taskId),
  };
}

const visibleGroups = (groups: TaskGroup[]) =>
  groups.filter((group) => !group.collapsed && group.taskIds.length > 0);

function stepList(
  groups: TaskGroup[],
  taskId: string | null,
  direction: FocusDirection,
) {
  if (direction === "left" || direction === "right") return null;
  const ids = visibleGroups(groups).flatMap((group) => group.taskIds);
  if (ids.length === 0) return null;
  const index = taskId ? ids.indexOf(taskId) : -1;
  if (index === -1) return direction === "down" ? ids[0] : ids.at(-1);
  const next = direction === "down" ? index + 1 : index - 1;
  return ids[Math.min(Math.max(next, 0), ids.length - 1)];
}

function stepBoard(
  groups: TaskGroup[],
  taskId: string | null,
  direction: FocusDirection,
) {
  const visible = visibleGroups(groups);
  if (visible.length === 0) return null;
  const current = findTaskGroup(visible, taskId);
  if (!current) {
    return direction === "up" || direction === "left"
      ? visible.at(-1)?.taskIds.at(-1)
      : visible[0].taskIds[0];
  }
  const { group, groupIndex, index } = current;
  if (direction === "up") return group.taskIds[Math.max(index - 1, 0)];
  if (direction === "down")
    return group.taskIds[Math.min(index + 1, group.taskIds.length - 1)];
  const target = visible[groupIndex + (direction === "left" ? -1 : 1)];
  if (!target) return group.taskIds[index];
  return target.taskIds[Math.min(index, target.taskIds.length - 1)];
}

export function stepFocus(
  groups: TaskGroup[],
  layout: TaskLayout,
  taskId: string | null,
  direction: FocusDirection,
) {
  const next =
    layout === "board"
      ? stepBoard(groups, taskId, direction)
      : stepList(groups, taskId, direction);
  return next ?? null;
}

export function moveTarget(
  groups: TaskGroup[],
  layout: TaskLayout,
  taskId: string,
  direction: MoveDirection,
) {
  const current = findTaskGroup(groups, taskId);
  if (!current) return null;
  const { group, groupIndex, index } = current;
  const last = group.taskIds.length - 1;

  if (direction === "left" || direction === "right") {
    if (layout !== "board") return null;
    return groups[groupIndex + (direction === "left" ? -1 : 1)]?.id ?? null;
  }
  if (direction === "up" || direction === "top") {
    if (index === 0) return null;
    return group.taskIds[direction === "up" ? index - 1 : 0];
  }
  if (index === last) return null;
  return group.taskIds[direction === "down" ? index + 1 : last];
}
