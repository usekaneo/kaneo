import { useMutation, useQueryClient } from "@tanstack/react-query";
import { BadgeCheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { markAdminUserEmailVerified } from "@/fetchers/admin/mark-admin-user-email-verified";
import {
  ADMIN_USERS_QUERY_KEY,
  type AdminUser,
} from "@/hooks/queries/admin/use-admin-users";
import { toast } from "@/lib/toast";

function useMarkAdminUserEmailVerified() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (user: Pick<AdminUser, "id" | "email">) =>
      markAdminUserEmailVerified(user.id),
    onSuccess: (_result, user) => {
      toast.success(
        t("settings:adminUsers.toast.emailVerified", { email: user.email }),
        {
          icon: BadgeCheckIcon,
        },
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

export default useMarkAdminUserEmailVerified;
