import { useMutation } from "@tanstack/react-query";
import { MailCheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sendAdminTestEmail } from "@/fetchers/admin/send-admin-test-email";
import { toast } from "@/lib/toast";

function useSendAdminTestEmail() {
  const { t } = useTranslation();

  return useMutation({
    mutationFn: sendAdminTestEmail,
    onSuccess: ({ to }) => {
      toast.success(t("settings:adminSystem.toast.testEmailSent", { to }), {
        icon: MailCheckIcon,
      });
    },
    onError: (error) => {
      toast.error(
        error instanceof Error && error.message
          ? error.message
          : t("settings:adminSystem.toast.testEmailError"),
      );
    },
  });
}

export default useSendAdminTestEmail;
