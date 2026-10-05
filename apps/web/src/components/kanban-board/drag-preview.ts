import type { Active, Over } from "@dnd-kit/core";
import type { ProjectWithTasks } from "@/types/project";
import { getVisualTaskPlacement, moveBoardTask } from "./move-task";

type DragItem = Pick<Active | Over, "id">;

function findColumn(board: ProjectWithTasks, id: string) {
  return board.columns.find(
    (column) => column.id === id || column.tasks.some((task) => task.id === id),
  );
}

export function getHoveredOtherColumnId(
  board: ProjectWithTasks,
  activeId: string,
  overId: string,
) {
  const from = findColumn(board, activeId);
  const to = findColumn(board, overId);
  return from && to && from.id !== to.id ? to.id : null;
}

// The card takes the hovered card's slot. Sortable transforms then move it
// above or below as the pointer travels, the same as within one column.
export function moveIntoHoveredColumn(
  board: ProjectWithTasks,
  active: DragItem,
  over: DragItem,
) {
  const activeId = active.id.toString();
  const overId = over.id.toString();
  if (!getHoveredOtherColumnId(board, activeId, overId)) return null;
  return moveBoardTask(board, activeId, overId, false, false)?.project ?? null;
}

// Applies the last sortable hover, which only exists as transforms, so the
// drop lands exactly where the card was shown.
export function getPreviewDropPlacement(
  board: ProjectWithTasks,
  active: DragItem,
  over: DragItem,
) {
  const activeId = active.id.toString();
  const overId = over.id.toString();
  const settled =
    moveIntoHoveredColumn(board, active, over) ??
    (overId === activeId
      ? board
      : (moveBoardTask(board, activeId, overId)?.project ?? board));
  return getVisualTaskPlacement(settled, activeId);
}
