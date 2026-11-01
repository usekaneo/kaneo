import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminModelCatalog } from "@/fetchers/admin-agent/get-model-catalog";

export function useAdminModelCatalog(provider: string) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin", "agent-catalog", user?.id ?? "", provider],
    queryFn: () => getAdminModelCatalog(provider),
    enabled: Boolean(provider && user?.id),
    staleTime: 5 * 60_000,
    retry: false,
  });
}
