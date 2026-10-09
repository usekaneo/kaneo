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
      data: Parameters<typeof upsertWorkflowRule>[1];
    }) => upsertWorkflowRule(projectId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workflow-rules", variables.projectId],
      });
    },
  });
}
