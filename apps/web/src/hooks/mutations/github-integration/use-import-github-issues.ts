import { useMutation } from "@tanstack/react-query";
import importGithubIssues from "@/fetchers/github-integration/import-github-issues";
import queryClient from "@/query-client";

function useImportGithubIssues() {
  return useMutation({
    mutationFn: importGithubIssues,
    onSettled: async (_data, _error, variables) => {
      // A failed request can follow successfully persisted pages.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks"] }),
        queryClient.invalidateQueries({ queryKey: ["labels"] }),
        queryClient.invalidateQueries({
          queryKey: ["github-integration", variables.projectId],
        }),
      ]);
    },
  });
}

export default useImportGithubIssues;
