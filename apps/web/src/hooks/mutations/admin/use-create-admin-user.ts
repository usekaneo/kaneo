import { useMutation, useQueryClient } from "@tanstack/react-query";
import { UserPlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createAdminUser } from "@/fetchers/admin/create-admin-user";
import { ADMIN_ROLES_QUERY_KEY } from "@/hooks/queries/admin/use-admin-roles";
import { ADMIN_USERS_QUERY_KEY } from "@/hooks/queries/admin/use-admin-users";
import { toast } from "@/lib/toast";

const CREATED_TOAST_KEYS = {
  sent: "settings:adminUsers.toast.createdLinkSent",
  not_needed: "settings:adminUsers.toast.createdForSso",
  not_configured: "settings:adminUsers.toast.createdNoSmtp",
  failed: "settings:adminUsers.toast.createdLinkFailed",
} as const;

function useCreateAdminUser() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createAdminUser,
    onSuccess: ({ user, passwordSetupEmail }) => {
      const message = t(CREATED_TOAST_KEYS[passwordSetupEmail], {
        email: user.email,
      });
      if (
        passwordSetupEmail === "sent" ||
        passwordSetupEmail === "not_needed"
      ) {
        toast.success(message, { icon: UserPlusIcon });
      } else {
        toast.warning(message);
      }
      queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_ROLES_QUERY_KEY });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminUsers.toast.createError"),
      );
    },
  });
}

export default useCreateAdminUser;
