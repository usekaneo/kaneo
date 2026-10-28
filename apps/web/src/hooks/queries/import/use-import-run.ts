import { useQuery } from "@tanstack/react-query";
import getImportRun from "@/fetchers/import/get-import-run";

function useImportRun(workspaceId: string, runId: string) {
  return useQuery({
    queryKey: ["import-run", workspaceId, runId],
    queryFn: () => getImportRun(workspaceId, runId),
    select: (data) => data.run,
    enabled: Boolean(workspaceId && runId),
    refetchOnMount: "always",
    refetchInterval: (query) =>
      query.state.data?.run.status === "running" ? 1500 : false,
  });
}

export default useImportRun;
