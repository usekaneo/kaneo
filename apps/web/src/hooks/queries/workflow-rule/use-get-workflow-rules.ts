import { useQuery } from "@tanstack/react-query";
import getWorkflowRules from "@/fetchers/workflow-rule/get-workflow-rules";

export function useGetWorkflowRules(projectId: string) {
  return useQuery({
    queryKey: ["workflow-rules", projectId],
    queryFn: () => getWorkflowRules(projectId),
    enabled: !!projectId,
  });
}
