import { useMutation } from "@tanstack/react-query";
import { KeyRoundIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sendAdminUserPasswordReset } from "@/fetchers/admin/send-admin-user-password-reset";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import { toast } from "@/lib/toast";

function useSendAdminUserPasswordReset() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (user: Pick<AdminUser, "id" | "email">) =>
      sendAdminUserPasswordReset(user.id),
    onSuccess: (_result, user) => {
      toast.success(
        t("settings:adminUsers.toast.passwordResetSent", { email: user.email }),
        {
          icon: KeyRoundIcon,
        },
      );
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminUsers.toast.emailError"),
      );
    },
  });
}

export default useSendAdminUserPasswordReset;
