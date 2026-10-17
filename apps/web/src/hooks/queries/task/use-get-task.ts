import { useQuery } from "@tanstack/react-query";
import getTask from "@/fetchers/task/get-task";

function useGetTask(taskId: string, refreshWhileVisible = false) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId),
    enabled: Boolean(taskId),
    refetchOnMount: "always",
    staleTime: 0,
    refetchInterval: refreshWhileVisible ? 30_000 : false,
    refetchOnWindowFocus: refreshWhileVisible ? "always" : false,
  });
}

export default useGetTask;
