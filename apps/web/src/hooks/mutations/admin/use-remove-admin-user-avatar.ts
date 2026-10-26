import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ImageMinusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { removeAdminUserAvatar } from "@/fetchers/admin/remove-admin-user-avatar";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";
import { toast } from "@/lib/toast";

function useRemoveAdminUserAvatar() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeAdminUserAvatar,
    onSuccess: () => {
      toast.success(t("settings:adminUsers.toast.avatarRemoved"), {
        icon: ImageMinusIcon,
      });
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminUsers.toast.avatarError"),
      );
    },
  });
}

export default useRemoveAdminUserAvatar;
