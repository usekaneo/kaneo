import { useQuery } from "@tanstack/react-query";
import getSyncRules from "@/fetchers/integration-sync/get-sync-rules";
import type { SyncParams } from "@/fetchers/integration-sync/types";

export function useSyncRules(param: SyncParams, after?: string) {
  return useQuery({
    queryKey: [
      "integration-sync",
      param.projectId,
      param.provider,
      after ?? "",
    ],
    queryFn: () => getSyncRules(param, after),
  });
}
