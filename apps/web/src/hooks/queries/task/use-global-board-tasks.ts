import { useInfiniteQuery } from "@tanstack/react-query";
import { startOfWeek } from "date-fns";
import type {
  GlobalBoardFilters,
  GlobalBoardLane,
} from "@/components/global-board/global-board-filters";
import getGlobalBoardTasks, {
  type GlobalBoardTasksQuery,
} from "@/fetchers/task/get-global-board-tasks";
import { useUserPreferencesStore } from "@/store/user-preferences";

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
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  return useInfiniteQuery({
    queryKey: globalBoardTasksKey(lane, filters),
    queryFn: ({ pageParam }) =>
      getGlobalBoardTasks({
        ...(filters as Omit<GlobalBoardTasksQuery, "globalStatus">),
        // "This week" follows the viewer's calendar, like project boards.
        ...(filters.dueDate
          ? {
              dueWeekStart: startOfWeek(new Date(), {
                weekStartsOn,
              }).toISOString(),
            }
          : {}),
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
