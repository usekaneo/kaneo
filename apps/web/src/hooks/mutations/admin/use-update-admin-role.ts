import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateAdminRole } from "@/fetchers/admin/update-admin-role";
import { toast } from "@/lib/toast";
import { refreshAfterRoleChange } from "./refresh-after-role-change";

function useUpdateAdminRole() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminRole,
    onSuccess: () => {
      toast.success(t("settings:adminRoles.toast.updated"));
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

export default useUpdateAdminRole;
