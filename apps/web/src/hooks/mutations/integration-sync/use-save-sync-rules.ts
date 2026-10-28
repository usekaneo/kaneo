import { useMutation, useQueryClient } from "@tanstack/react-query";
import saveSyncRules from "@/fetchers/integration-sync/save-sync-rules";
import type { SyncParams, SyncRules } from "@/fetchers/integration-sync/types";

export function useSaveSyncRules(param: SyncParams) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      rules,
      previewToken,
    }: {
      rules: SyncRules;
      previewToken: string;
    }) => saveSyncRules(param, rules, previewToken),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["integration-sync", param.projectId],
      });
      await client.invalidateQueries({
        queryKey: ["integration-sync-preview", param.projectId],
      });
      await client.invalidateQueries({ queryKey: ["external-links"] });
    },
  });
}
