import { useInfiniteQuery } from "@tanstack/react-query";
import type {
  GlobalBoardFilters,
  GlobalBoardLane,
} from "@/components/global-board/global-board-filters";
import getGlobalBoardTasks from "@/fetchers/task/get-global-board-tasks";

export const GLOBAL_BOARD_PAGE_SIZE = 25;

export function globalBoardTasksKey(
  lane: GlobalBoardLane,
  filters: GlobalBoardFilters,
) {
  return ["global-board", "tasks", lane, filters] as const;
}

function useGlobalBoardTasks(
  lane: GlobalBoardLane,
  filters: GlobalBoardFilters,
) {
  return useInfiniteQuery({
    queryKey: globalBoardTasksKey(lane, filters),
    queryFn: ({ pageParam }) =>
      getGlobalBoardTasks({
        ...filters,
        globalStatus: lane,
        page: String(pageParam),
        limit: String(GLOBAL_BOARD_PAGE_SIZE),
      }),
    initialPageParam: 1,
    getNextPageParam: (last) =>
      last.pagination.page < last.pagination.totalPages
        ? last.pagination.page + 1
        : undefined,
    // Like My tasks, this spans projects without a project socket: refresh
    // remote edits while the page is visible.
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}

export default useGlobalBoardTasks;
