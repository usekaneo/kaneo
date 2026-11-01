import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateAdminAgentSettings } from "@/fetchers/admin-agent/update-model-settings";
import { ADMIN_AGENT_SETTINGS_KEY } from "@/hooks/queries/admin/use-admin-agent-settings";
import { toast } from "@/lib/toast";

export function useUpdateAdminAgentSettings() {
  const queryClient = useQueryClient();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: updateAdminAgentSettings,
    onSuccess: (settings) => {
      queryClient.setQueriesData(
        { queryKey: ADMIN_AGENT_SETTINGS_KEY },
        settings,
      );
      queryClient.invalidateQueries({
        predicate: ({ queryKey }) =>
          queryKey[0] === "agent" && queryKey[2] === "config",
      });
      toast.success(t("settings:adminAgent.saved"));
    },
    onError: () => toast.error(t("settings:adminAgent.saveError")),
  });
}
