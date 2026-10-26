import type { ProjectWithTasks } from "@/types/project";
import { moveBoardTask } from "./move-task";
import type { BoardMove } from "./use-board-move-queue";

export function previewBoardMoves(
  project: ProjectWithTasks,
  moves: BoardMove[],
  appendOnly: boolean,
) {
  return moves.reduce(
    (board, move) =>
      moveBoardTask(
        board,
        move.activeId,
        move.overId,
        appendOnly,
        move.insertAfterTarget,
      )?.project ?? board,
    project,
  );
}
