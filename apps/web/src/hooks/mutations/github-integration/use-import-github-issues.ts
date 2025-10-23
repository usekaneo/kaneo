import { useMutation } from "@tanstack/react-query";
import importGithubIssues from "@/fetchers/github-integration/import-github-issues";
import queryClient from "@/query-client";

function useImportGithubIssues() {
  return useMutation({
    mutationFn: importGithubIssues,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}

export default useImportGithubIssues;
