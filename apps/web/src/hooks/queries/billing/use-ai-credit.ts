import { useQuery } from "@tanstack/react-query";
import { getAiCredit } from "@/fetchers/billing/ai-credit";

export function useAiCredit(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["billing", workspaceId, "ai"],
    queryFn: () => getAiCredit(workspaceId!),
    enabled: Boolean(workspaceId),
    refetchInterval: 10000,
  });
}
