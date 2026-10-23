import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import type { GlobalBoardLane } from "./global-board-filters";

export type BoardDrag = {
  task: GlobalBoardTask;
  from: GlobalBoardLane;
  lane: GlobalBoardLane;
  index: number;
  // Held after the drop until the server answers, so the card stays put while
  // the cache catches up.
  dropped?: boolean;
};

/** A lane's cards as they should render during or right after a drag. */
export function laneTasksDuringDrag(
  lane: GlobalBoardLane,
  tasks: readonly GlobalBoardTask[],
  drag: BoardDrag | null,
): GlobalBoardTask[] {
  if (!drag) return [...tasks];
  // Inside its own lane, dnd-kit's sorting animation shows the new place.
  if (lane === drag.from && drag.lane === lane && !drag.dropped)
    return [...tasks];
  const rest = tasks.filter((task) => task.id !== drag.task.id);
  if (drag.lane !== lane) return rest;
  const at = Math.min(Math.max(drag.index, 0), rest.length);
  return [...rest.slice(0, at), drag.task, ...rest.slice(at)];
}

/** Where the dragged card ends up in its lane when released over `overId`. */
export function dropIndex(
  laneTasks: readonly GlobalBoardTask[],
  activeId: string,
  overId: string | null,
) {
  const from = laneTasks.findIndex((task) => task.id === activeId);
  const to = overId
    ? laneTasks.findIndex((task) => task.id === overId)
    : laneTasks.length - 1;
  if (to < 0) return from < 0 ? laneTasks.length : from;
  return to;
}
