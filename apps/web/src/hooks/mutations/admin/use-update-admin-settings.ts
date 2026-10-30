import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateAdminSettings } from "@/fetchers/admin/update-admin-settings";
import { ADMIN_SETTINGS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-settings";
import { ADMIN_SYSTEM_STATUS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-system-status";
import { configQueryOptions } from "@/hooks/queries/config/use-get-config";
import { toast } from "@/lib/toast";

function useUpdateAdminSettings() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminSettings,
    onSuccess: (settings) => {
      queryClient.setQueriesData(
        { queryKey: ADMIN_SETTINGS_QUERY_KEY },
        settings,
      );
      queryClient.invalidateQueries({
        queryKey: configQueryOptions().queryKey,
      });
      queryClient.invalidateQueries({ queryKey: ["admin", "overview"] });
      queryClient.invalidateQueries({
        queryKey: ADMIN_SYSTEM_STATUS_QUERY_KEY,
      });
      toast.success(t("settings:adminSettings.toast.saved"));
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminSettings.toast.error"),
      );
    },
  });
}

export default useUpdateAdminSettings;
