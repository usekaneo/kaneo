import { MailIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { StatusBadge } from "@/components/settings/status-badge";
import { Switch } from "@/components/ui/switch";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { useUpdateNotificationPreferences } from "@/hooks/mutations/notification-preferences/use-notification-preferences";

type EmailChannelRowProps = {
  preferences: NotificationPreferences;
};

export function EmailChannelRow({ preferences }: EmailChannelRowProps) {
  const { t } = useTranslation();
  const { mutate, isPending, variables } = useUpdateNotificationPreferences();
  const enabled = isPending
    ? (variables?.emailEnabled ?? preferences.emailEnabled)
    : preferences.emailEnabled;

  return (
    <SettingsRow
      icon={<MailIcon />}
      title={t("settings:notificationsPage.emailTitle")}
      badge={
        enabled ? (
          <StatusBadge tone="success">
            {t("settings:notificationsPage.statusOn")}
          </StatusBadge>
        ) : null
      }
      description={
        preferences.emailAddress ? (
          <span className="font-mono">{preferences.emailAddress}</span>
        ) : (
          t("settings:notificationsPage.accountEmailNoAddress")
        )
      }
    >
      <Switch
        aria-label={t("settings:notificationsPage.emailToggleLabel")}
        checked={enabled}
        disabled={isPending || !preferences.emailAddress}
        onCheckedChange={(checked) => mutate({ emailEnabled: checked })}
      />
    </SettingsRow>
  );
}
