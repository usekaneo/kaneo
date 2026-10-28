import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { deleteAdminRole } from "@/fetchers/admin/delete-admin-role";
import { toast } from "@/lib/toast";
import { refreshAfterRoleChange } from "./refresh-after-role-change";

function useDeleteAdminRole() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteAdminRole,
    onSuccess: () => {
      toast.success(t("settings:adminRoles.toast.deleted"));
      refreshAfterRoleChange(queryClient);
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminRoles.toast.error"),
      );
    },
  });
}

export default useDeleteAdminRole;
