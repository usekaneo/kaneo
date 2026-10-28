import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { createAdminRole } from "@/fetchers/admin/create-admin-role";
import { toast } from "@/lib/toast";
import { refreshAfterRoleChange } from "./refresh-after-role-change";

function useCreateAdminRole() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAdminRole,
    onSuccess: () => {
      toast.success(t("settings:adminRoles.toast.created"));
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

export default useCreateAdminRole;
