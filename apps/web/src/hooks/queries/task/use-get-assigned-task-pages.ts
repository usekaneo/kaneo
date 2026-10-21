import { useInfiniteQuery } from "@tanstack/react-query";
import getAssignedTasks from "@/fetchers/task/get-assigned-tasks";

export function useGetAssignedTaskPages(workspaceId: string) {
  return useInfiniteQuery({
    queryKey: ["assigned-tasks", workspaceId, "pages"],
    queryFn: ({ pageParam }) => getAssignedTasks(workspaceId, false, pageParam),
    initialPageParam: 1,
    getNextPageParam: (lastPage, pages) => {
      const loaded = new Set(
        pages.flatMap((page) => page.tasks.map((task) => task.id)),
      ).size;
      return lastPage.tasks.length > 0 && loaded < lastPage.total
        ? pages.length + 1
        : undefined;
    },
    enabled: Boolean(workspaceId),
    refetchOnMount: "always",
    refetchInterval: 30_000,
    refetchOnWindowFocus: "always",
  });
}
