import { BellOffIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsEmpty } from "@/components/settings/settings-empty";
import useGetNotificationPreferences from "@/hooks/queries/notification-preferences/use-get-notification-preferences";
import { ChannelsSection } from "./channels/channels-section";
import { NotifyMeSection } from "./events/notify-me-section";
import { NotificationSettingsSkeleton } from "./notification-settings-skeleton";
import { WorkspacesSection } from "./workspaces/workspaces-section";

export function NotificationSettings() {
  const { t } = useTranslation();
  const { data: preferences, isLoading } = useGetNotificationPreferences();

  if (isLoading) return <NotificationSettingsSkeleton />;

  if (!preferences) {
    return (
      <SettingsCard>
        <SettingsEmpty
          icon={<BellOffIcon />}
          title={t("settings:notificationsPage.loadFailed")}
        />
      </SettingsCard>
    );
  }

  return (
    <>
      <NotifyMeSection preferences={preferences} />
      <ChannelsSection preferences={preferences} />
      <WorkspacesSection preferences={preferences} />
    </>
  );
}
