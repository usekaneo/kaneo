import getTask from "@/fetchers/task/get-task";
import { useQuery } from "@tanstack/react-query";

function useGetTask(taskId: string) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export default useGetTask;
