import type { ProjectWithTasks } from "@/types/project";
import { findTaskColumn } from "./find-task-column";

export function getHoveredOtherColumnId(
  board: ProjectWithTasks,
  activeId: string,
  overId: string,
) {
  const from = findTaskColumn(board, activeId);
  const to = findTaskColumn(board, overId);
  return from && to && from.id !== to.id ? to.id : null;
}
