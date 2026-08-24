import { useMutation, useQueryClient } from "@tanstack/react-query";
import importGitlabIssues from "@/fetchers/gitlab-integration/import-gitlab-issues";

export default function useImportGitlabIssues() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (projectId: string) => importGitlabIssues(projectId),
    onSuccess: (_, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["tasks", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}
