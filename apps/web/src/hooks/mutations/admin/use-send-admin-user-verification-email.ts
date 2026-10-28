import { useMutation } from "@tanstack/react-query";
import { MailCheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sendAdminUserVerificationEmail } from "@/fetchers/admin/send-admin-user-verification-email";
import type { AdminUser } from "@/hooks/queries/admin/use-admin-users";
import { toast } from "@/lib/toast";

function useSendAdminUserVerificationEmail() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: (user: Pick<AdminUser, "id" | "email">) =>
      sendAdminUserVerificationEmail(user.id),
    onSuccess: (_result, user) => {
      toast.success(
        t("settings:adminUsers.toast.verificationSent", { email: user.email }),
        {
          icon: MailCheckIcon,
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

export default useSendAdminUserVerificationEmail;
