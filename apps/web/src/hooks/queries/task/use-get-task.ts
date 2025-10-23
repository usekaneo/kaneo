import { useQuery } from "@tanstack/react-query";
import getTask from "@/fetchers/task/get-task";

function useGetTask(taskId: string) {
  return useQuery({
    queryKey: ["task", taskId],
    queryFn: () => getTask(taskId),
    refetchOnMount: "always",
    staleTime: 0,
  });
}

export default useGetTask;
