import { MailIcon, SendIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { AdminSystemStatus } from "@/fetchers/admin/system-types";
import useSendAdminTestEmail from "@/hooks/mutations/admin/use-send-admin-test-email";
import { ServiceStatusBadge } from "./service-status-badge";
import { SystemStatusRow } from "./system-status-row";

type EmailSectionProps = {
  email: AdminSystemStatus["email"];
};

export function EmailSection({ email }: EmailSectionProps) {
  const { t } = useTranslation();
  const sendTestEmail = useSendAdminTestEmail();

  const description =
    email.status === "not_configured"
      ? t("settings:adminSystem.email.notConfigured")
      : email.status === "ok"
        ? t("settings:adminSystem.email.ok")
        : t("settings:adminSystem.email.down", {
            code: email.errorCode ?? "UNKNOWN",
          });

  return (
    <SettingsSection title={t("settings:adminSystem.email.title")}>
      <SettingsCard>
        <SystemStatusRow
          icon={<MailIcon />}
          title={t("settings:adminSystem.email.smtp")}
          description={description}
          status={<ServiceStatusBadge status={email.status} />}
        />
        <SystemStatusRow
          icon={<SendIcon />}
          title={t("settings:adminSystem.email.sendTest")}
          status={
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!email.configured || sendTestEmail.isPending}
              onClick={() => sendTestEmail.mutate()}
            >
              {sendTestEmail.isPending ? (
                <Spinner aria-hidden="true" />
              ) : (
                <SendIcon aria-hidden="true" />
              )}
              {sendTestEmail.isPending
                ? t("settings:adminSystem.email.sending")
                : t("settings:adminSystem.email.send")}
            </Button>
          }
        />
      </SettingsCard>
    </SettingsSection>
  );
}
