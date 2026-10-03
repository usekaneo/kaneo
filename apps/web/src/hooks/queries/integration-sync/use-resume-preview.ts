import { useQuery } from "@tanstack/react-query";
import reviewSyncResume from "@/fetchers/integration-sync/review-sync-resume";
import type { SyncParams } from "@/fetchers/integration-sync/types";

export function useResumePreview(param: SyncParams, linkId: string) {
  return useQuery({
    queryKey: [
      "integration-sync-review",
      param.projectId,
      param.provider,
      linkId,
    ],
    queryFn: () => reviewSyncResume(param, linkId),
    retry: false,
    staleTime: 0,
  });
}
