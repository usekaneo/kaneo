import { useQuery } from "@tanstack/react-query";
import getImportRuns from "@/fetchers/import/get-import-runs";

function useImportRuns(workspaceId: string) {
  return useQuery({
    queryKey: ["import-runs", workspaceId],
    queryFn: () => getImportRuns(workspaceId),
    select: (data) => data.runs,
    enabled: Boolean(workspaceId),
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.runs.some((run) => run.status === "running")
        ? 1500
        : false,
  });
}

export default useImportRuns;
