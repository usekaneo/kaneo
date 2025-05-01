import getLabelsByTask from "@/fetchers/label/get-labels-by-task";
import { useQuery } from "@tanstack/react-query";

function useGetLabelsByTask(taskId: string) {
  return useQuery({
    queryKey: ["labels", taskId],
    queryFn: () => getLabelsByTask({ taskId }),
  });
}

export default useGetLabelsByTask;
