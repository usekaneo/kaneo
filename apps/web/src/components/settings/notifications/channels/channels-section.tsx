import { BellIcon, SquareTerminalIcon, WebhookIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { getChannelAvailability } from "../get-channel-availability";
import { getUrlHost } from "../get-url-host";
import type { ExternalChannelId } from "../notification-channels";
import { ChannelRow } from "./channel-row";
import { EmailChannelRow } from "./email-channel-row";
import { GotifyChannelPanel } from "./gotify-channel-panel";
import { NtfyChannelPanel } from "./ntfy-channel-panel";
import { WebhookChannelPanel } from "./webhook-channel-panel";

type ChannelsSectionProps = {
  preferences: NotificationPreferences;
};

export function ChannelsSection({ preferences }: ChannelsSectionProps) {
  const { t } = useTranslation();
  const [openChannel, setOpenChannel] = useState<ExternalChannelId | null>(
    null,
  );
  const availability = getChannelAvailability(preferences);
  const closePanel = () => setOpenChannel(null);
  const panelToggle = (channel: ExternalChannelId) => (open: boolean) =>
    setOpenChannel(open ? channel : null);

  return (
    <SettingsSection
      title={t("settings:notificationsPage.channelsTitle")}
      description={t("settings:notificationsPage.channelsDescription")}
    >
      <SettingsCard>
        <EmailChannelRow preferences={preferences} />
        <ChannelRow
          availability={availability.gotify}
          channel="gotify"
          description={t("settings:notificationsPage.gotifyDescription")}
          detail={getUrlHost(preferences.gotifyServerUrl)}
          icon={<BellIcon className="text-blue-500" />}
          name={t("settings:notificationsPage.gotifyTitle")}
          onOpenChange={panelToggle("gotify")}
          open={openChannel === "gotify"}
        >
          <GotifyChannelPanel
            onDisconnected={closePanel}
            preferences={preferences}
          />
        </ChannelRow>
        <ChannelRow
          availability={availability.ntfy}
          channel="ntfy"
          description={t("settings:notificationsPage.ntfyDescription")}
          detail={getUrlHost(preferences.ntfyServerUrl)}
          icon={<SquareTerminalIcon className="text-green-600" />}
          name={t("settings:notificationsPage.ntfyTitle")}
          onOpenChange={panelToggle("ntfy")}
          open={openChannel === "ntfy"}
        >
          <NtfyChannelPanel
            onDisconnected={closePanel}
            preferences={preferences}
          />
        </ChannelRow>
        <ChannelRow
          availability={availability.webhook}
          channel="webhook"
          description={t("settings:notificationsPage.webhookDescription")}
          detail={getUrlHost(preferences.webhookUrl)}
          icon={<WebhookIcon />}
          name={t("settings:notificationsPage.webhookTitle")}
          onOpenChange={panelToggle("webhook")}
          open={openChannel === "webhook"}
        >
          <WebhookChannelPanel
            onDisconnected={closePanel}
            preferences={preferences}
          />
        </ChannelRow>
      </SettingsCard>
    </SettingsSection>
  );
}
