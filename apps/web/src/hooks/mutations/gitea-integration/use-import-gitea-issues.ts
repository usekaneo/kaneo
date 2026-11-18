import { useMutation, useQueryClient } from "@tanstack/react-query";
import importGiteaIssues from "@/fetchers/gitea-integration/import-gitea-issues";

export default function useImportGiteaIssues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      projectId,
      integrationId,
    }: {
      projectId: string;
      integrationId: string;
    }) => importGiteaIssues({ projectId, integrationId }),
    onSuccess: (_, { projectId }) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}
