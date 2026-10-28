import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ADMIN_WEBHOOKS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-webhooks";
import { toast } from "@/lib/toast";
export default function useAdminWebhookMutation<T, R>(
  mutationFn: (input: T) => Promise<R>,
) {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn,
    gcTime: 0,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ADMIN_WEBHOOKS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ["admin", "audit-log"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
    },
    onError: (error) =>
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:adminWebhooks.saveError"),
      ),
  });
}
