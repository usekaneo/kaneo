import { useMutation, useQueryClient } from "@tanstack/react-query";
import { MailCheckIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { sendAdminTestEmail } from "@/fetchers/admin/send-admin-test-email";
import { ADMIN_AUDIT_LOG_QUERY_KEY } from "@/hooks/queries/admin/use-admin-audit-log";
import { toast } from "@/lib/toast";

function useSendAdminTestEmail() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: sendAdminTestEmail,
    onSuccess: ({ to }) => {
      void queryClient.invalidateQueries({
        queryKey: ADMIN_AUDIT_LOG_QUERY_KEY,
        refetchType: "all",
      });
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
