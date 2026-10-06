import type { ProjectWithTasks } from "@/types/project";
import { moveBoardTask } from "../move-task";
import { getVisualTaskPlacement } from "./get-visual-task-placement";
import { moveIntoHoveredColumn } from "./move-into-hovered-column";

export function getPreviewDropPlacement(
  board: ProjectWithTasks,
  activeId: string,
  overId: string,
) {
  const settled =
    moveIntoHoveredColumn(board, activeId, overId) ??
    (overId === activeId
      ? board
      : (moveBoardTask(board, activeId, overId)?.project ?? board));
  return getVisualTaskPlacement(settled, activeId);
}
