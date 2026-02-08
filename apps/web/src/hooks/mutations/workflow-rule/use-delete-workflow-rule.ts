import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteWorkflowRule from "@/fetchers/workflow-rule/delete-workflow-rule";

export function useDeleteWorkflowRule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id }: { id: string; projectId: string }) =>
      deleteWorkflowRule(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["workflow-rules", variables.projectId],
      });
    },
  });
}
