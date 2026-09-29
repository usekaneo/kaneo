import { useState } from "react";
import { markBoardCacheChanged } from "@/lib/board-cache-version";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import getTasks from "@/fetchers/task/get-tasks";

export function useGetTasks(projectId: string) {
  const queryClient = useQueryClient();
  const [progress, setProgress] =
    useState<Awaited<ReturnType<typeof getTasks>>>();
  const query = useQuery({
    queryKey: ["tasks", projectId],
    queryFn: async ({ signal }) => {
      setProgress(undefined);
      markBoardCacheChanged(queryClient, projectId);
      const hasCachedBoard = !!queryClient.getQueryData(["tasks", projectId]);
      try {
        return await getTasks(projectId, signal, (board) => {
          if (!hasCachedBoard) setProgress(board);
        });
      } finally {
        setProgress(undefined);
      }
    },
    refetchOnMount: true,
    refetchOnWindowFocus: true,
    enabled: !!projectId,
  });
  return {
    ...query,
    data: query.data ?? (query.isFetching ? progress : undefined),
  };
}
