import { useQuery } from "@tanstack/react-query";
import getLabelsByTask from "@/fetchers/label/get-labels-by-task";
import { localeCompareSort } from "@/lib/format";

function useGetLabelsByTask(taskId: string) {
  return useQuery({
    queryKey: ["labels", taskId],
    queryFn: () => getLabelsByTask({ taskId }),
    select: (labels) =>
      [...labels].sort((a, b) => localeCompareSort(a.name, b.name)),
    refetchOnMount: true,
  });
}

export default useGetLabelsByTask;
