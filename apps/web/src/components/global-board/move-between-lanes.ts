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

// The server orders lanes by priority; the next refetch settles the position.
export function addToLane(
  lane: LaneData | undefined,
  task: GlobalBoardTask,
): LaneData | undefined {
  const [first, ...rest] = lane?.pages ?? [];
  if (!lane || !first) return lane;
  return {
    ...lane,
    pages: [
      { ...adjustTotal(first, 1), tasks: [task, ...first.tasks] },
      ...rest.map((page) => adjustTotal(page, 1)),
    ],
  };
}
