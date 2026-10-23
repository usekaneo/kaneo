import { useMutation, useQueryClient } from "@tanstack/react-query";
import setProjectDefaultLabels from "@/fetchers/label/set-project-default-labels";
import { projectDefaultLabelsKey } from "@/hooks/queries/label/use-get-project-default-labels";
import { WORKSPACE_DEFAULT_LABELS_KEY } from "@/hooks/queries/label/use-get-workspace-default-labels";

function useSetProjectDefaultLabels(projectId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (labelIds: string[]) =>
      setProjectDefaultLabels({ projectId, labelIds }),
    onSuccess: (labels) => {
      queryClient.setQueryData(projectDefaultLabelsKey(projectId), labels);
      void queryClient.invalidateQueries({
        queryKey: WORKSPACE_DEFAULT_LABELS_KEY,
      });
    },
  });
}

export default useSetProjectDefaultLabels;
