import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminOverview } from "@/fetchers/admin/get-admin-overview";

export default function useAdminOverview() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["admin", "overview", user?.id ?? ""],
    queryFn: getAdminOverview,
    enabled: Boolean(user?.id),
    staleTime: 0,
    refetchOnWindowFocus: false,
    retry: false,
  });
}
