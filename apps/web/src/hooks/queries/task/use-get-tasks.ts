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
      let invalidated = false;
      const unsubscribe = hasCachedBoard
        ? () => {}
        : queryClient.getQueryCache().subscribe((event) => {
            if (
              event.query.queryKey[0] !== "tasks" ||
              event.query.queryKey[1] !== projectId
            )
              return;
            if (event.type === "updated" && event.action.type === "invalidate")
              invalidated = true;
            if (
              event.type === "removed" ||
              (event.type === "updated" &&
                event.query.state.fetchStatus === "idle")
            ) {
              unsubscribe();
              if (
                invalidated &&
                !signal.aborted &&
                event.type === "updated" &&
                event.action.type === "success"
              ) {
                queueMicrotask(() => {
                  if (
                    signal.aborted ||
                    !queryClient.getQueryData(["tasks", projectId])
                  )
                    return;
                  void queryClient.invalidateQueries({
                    queryKey: ["tasks", projectId],
                  });
                });
              }
            }
          });
      try {
        return await getTasks(projectId, signal, (board) => {
          if (!hasCachedBoard) setProgress(board);
        });
      } catch (error) {
        unsubscribe();
        throw error;
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
