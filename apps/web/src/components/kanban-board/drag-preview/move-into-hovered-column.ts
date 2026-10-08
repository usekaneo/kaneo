import type { ProjectWithTasks } from "@/types/project";
import { moveBoardTask } from "../move-task";
import { getHoveredOtherColumnId } from "./get-hovered-other-column-id";

export function moveIntoHoveredColumn(
  board: ProjectWithTasks,
  activeId: string,
  overId: string,
) {
  if (!getHoveredOtherColumnId(board, activeId, overId)) return null;
  return moveBoardTask(board, activeId, overId, false, false)?.project ?? null;
}
