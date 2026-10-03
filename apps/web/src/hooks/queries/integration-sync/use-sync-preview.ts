import { useQuery } from "@tanstack/react-query";
import previewSyncRules from "@/fetchers/integration-sync/preview-sync-rules";
import type { SyncParams, SyncRules } from "@/fetchers/integration-sync/types";

export function useSyncPreview(
  param: SyncParams,
  rules: SyncRules,
  enabled: boolean,
) {
  return useQuery({
    queryKey: [
      "integration-sync-preview",
      param.projectId,
      param.provider,
      rules,
    ],
    queryFn: () => previewSyncRules(param, rules),
    enabled,
    retry: false,
    staleTime: 0,
  });
}
