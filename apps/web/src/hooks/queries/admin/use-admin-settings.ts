import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminSettings } from "@/fetchers/admin/get-admin-settings";

export const ADMIN_SETTINGS_QUERY_KEY = ["admin", "settings"] as const;

function useAdminSettings() {
  const { user } = useAuth();
  const userId = user?.id ?? "";
  return useQuery({
    queryKey: [...ADMIN_SETTINGS_QUERY_KEY, userId],
    queryFn: getAdminSettings,
    enabled: userId !== "",
  });
}

export default useAdminSettings;
