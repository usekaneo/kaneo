import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { updateAdminUser } from "@/fetchers/admin/update-admin-user";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";
import { toast } from "@/lib/toast";

function useUpdateAdminUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateAdminUser,
    onSuccess: () => {
      toast.success(t("settings:adminUsers.toast.updated"));
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminUsers.toast.updateError"),
      );
    },
  });
}

export default useUpdateAdminUser;
