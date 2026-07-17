import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toggleAdminUserStatus } from "@/fetchers/admin/toggle-admin-user-status";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";
import { toast } from "@/lib/toast";

function useToggleAdminUserStatus() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: toggleAdminUserStatus,
    onSuccess: (_, variables) => {
      toast.success(
        t(
          variables.deactivate
            ? "settings:adminUsers.toast.deactivated"
            : "settings:adminUsers.toast.reactivated",
        ),
      );
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminUsers.toast.actionError"),
      );
    },
  });
}

export default useToggleAdminUserStatus;
