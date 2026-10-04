import { useMutation, useQueryClient } from "@tanstack/react-query";
import resumeSync from "@/fetchers/integration-sync/resume-sync";
import type { SyncParams } from "@/fetchers/integration-sync/types";

export function useResumeSync(param: SyncParams, linkId: string) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({
      token,
      source,
    }: {
      token: string;
      source: "kaneo" | "provider";
    }) => resumeSync(param, linkId, token, source),
    onSuccess: async () => {
      await client.invalidateQueries({
        queryKey: ["integration-sync", param.projectId],
      });
      await client.invalidateQueries({
        queryKey: ["integration-sync-preview", param.projectId],
      });
      await client.invalidateQueries({
        queryKey: [
          "integration-sync-review",
          param.projectId,
          param.provider,
          linkId,
        ],
      });
      await client.invalidateQueries({ queryKey: ["external-links"] });
      await client.invalidateQueries({ queryKey: ["tasks"] });
    },
  });
}
