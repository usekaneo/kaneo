import type { InfiniteData } from "@tanstack/react-query";
import type {
  GlobalBoardTask,
  GlobalBoardTasksPage,
} from "@/fetchers/task/get-global-board-tasks";

type LaneData = InfiniteData<GlobalBoardTasksPage, number>;

function adjustTotal(page: GlobalBoardTasksPage, delta: number) {
  return {
    ...page,
    pagination: {
      ...page.pagination,
      total: Math.max(0, page.pagination.total + delta),
    },
  };
}

export function removeFromLane(
  lane: LaneData | undefined,
  taskId: string,
): LaneData | undefined {
  if (!lane) return lane;
  const present = lane.pages.some((page) =>
    page.tasks.some((task) => task.id === taskId),
  );
  if (!present) return lane;
  return {
    ...lane,
    pages: lane.pages.map((page) => ({
      ...adjustTotal(page, -1),
      tasks: page.tasks.filter((task) => task.id !== taskId),
    })),
  };
}

// Inserts at a position across the loaded pages, as the user dropped it.
export function insertIntoLane(
  lane: LaneData | undefined,
  task: GlobalBoardTask,
  index: number,
): LaneData | undefined {
  if (!lane?.pages.length) return lane;
  let remaining = Math.max(0, index);
  const last = lane.pages.length - 1;
  let inserted = false;
  return {
    ...lane,
    pages: lane.pages.map((page, pageIndex) => {
      const counted = adjustTotal(page, 1);
      if (inserted) return counted;
      if (remaining <= page.tasks.length || pageIndex === last) {
        inserted = true;
        const at = Math.min(remaining, page.tasks.length);
        return {
          ...counted,
          tasks: [...page.tasks.slice(0, at), task, ...page.tasks.slice(at)],
        };
      }
      remaining -= page.tasks.length;
      return counted;
    }),
  };
}
