import { useMutation, useQueryClient } from "@tanstack/react-query";
import upsertWorkflowRule from "@/fetchers/workflow-rule/upsert-workflow-rule";

export function useUpsertWorkflowRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      data,
    }: {
      projectId: string;
      data: { integrationType: string; eventType: string; columnId: string };
    }) => upsertWorkflowRule(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workflow-rules", variables.projectId],
      });
    },
  });
}
