import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminAgentSettings } from "@/fetchers/admin-agent/get-model-settings";

export const ADMIN_AGENT_SETTINGS_KEY = ["admin", "agent-settings"] as const;

export function useAdminAgentSettings() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...ADMIN_AGENT_SETTINGS_KEY, user?.id ?? ""],
    queryFn: getAdminAgentSettings,
    enabled: Boolean(user?.id),
  });
}
