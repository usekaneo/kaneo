import { useMutation, useQueryClient } from "@tanstack/react-query";
import importGiteaIssues from "@/fetchers/gitea-integration/import-gitea-issues";

export default function useImportGiteaIssues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => importGiteaIssues(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["task"] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}
