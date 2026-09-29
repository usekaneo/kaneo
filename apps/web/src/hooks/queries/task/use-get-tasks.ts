import { markBoardCacheChanged } from "@/lib/board-cache-version";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";

export function useGetTasks(projectId: string) {
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: ["tasks", projectId],
    queryFn: ({ signal }) => {
      markBoardCacheChanged(queryClient, projectId);
      const hasCachedBoard = !!queryClient.getQueryData(["tasks", projectId]);
      return getTasks(projectId, signal, (board) => {
        if (!hasCachedBoard)
          queryClient.setQueryData(["tasks", projectId], board);
      });
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!projectId,
  });
}
