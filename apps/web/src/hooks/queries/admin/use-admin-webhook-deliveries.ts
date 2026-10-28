import { useQuery } from "@tanstack/react-query";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { getAdminWebhookDeliveries } from "@/fetchers/admin/get-admin-webhook-deliveries";
import { ADMIN_WEBHOOKS_QUERY_KEY } from "./use-admin-webhooks";
export default function useAdminWebhookDeliveries(
  webhookId: string,
  open: boolean,
) {
  const { user } = useAuth();
  return useQuery({
    queryKey: [...ADMIN_WEBHOOKS_QUERY_KEY, user?.id, webhookId, "deliveries"],
    queryFn: () => getAdminWebhookDeliveries(webhookId),
    enabled: Boolean(user?.id) && open,
    refetchInterval: open ? 2000 : false,
  });
}
