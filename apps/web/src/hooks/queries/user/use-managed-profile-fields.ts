import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import type { GetConfigResponse } from "@/fetchers/config/get-config";
import getCurrentUser from "@/fetchers/user/get-current-user";
import useGetConfig from "@/hooks/queries/config/use-get-config";

export type ManagedProfileField =
  GetConfigResponse["customOAuthManagedProfileFields"][number];

function useManagedProfileFields(): readonly ManagedProfileField[] {
  const { user } = useAuth();
  const { data: config } = useGetConfig();
  const configured = config?.customOAuthManagedProfileFields ?? [];
  const enabled = Boolean(user?.id) && configured.length > 0;
  const { data, isPending } = useQuery({
    queryKey: ["current-user", user?.id],
    queryFn: getCurrentUser,
    enabled,
  });

  if (!enabled) return [];
  // Lock the configured fields until the server has answered for this user.
  return isPending ? configured : (data?.managedProfileFields ?? []);
}

export default useManagedProfileFields;
