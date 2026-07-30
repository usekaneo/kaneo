import { useQuery } from "@tanstack/react-query";
import { getBilling } from "@/fetchers/billing/get-billing";

export function useGetBilling(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["billing", workspaceId],
    queryFn: () => getBilling(workspaceId as string),
    enabled: Boolean(workspaceId),
  });
}
