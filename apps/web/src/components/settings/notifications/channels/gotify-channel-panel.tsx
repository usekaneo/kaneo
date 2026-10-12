import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { useUpdateNotificationPreferences } from "@/hooks/mutations/notification-preferences/use-notification-preferences";
import { ChannelField } from "./channel-field";
import { ChannelPanelFooter } from "./channel-panel-footer";
import { ChannelSendingRow } from "./channel-sending-row";

type GotifyChannelPanelProps = {
  preferences: NotificationPreferences;
  onDisconnected: () => void;
};

export function GotifyChannelPanel({
  preferences,
  onDisconnected,
}: GotifyChannelPanelProps) {
  const { t } = useTranslation();
  const serverUrlId = useId();
  const tokenId = useId();
  const { mutateAsync, isPending } = useUpdateNotificationPreferences();
  const configured = preferences.gotifyConfigured;
  const [serverUrl, setServerUrl] = useState(preferences.gotifyServerUrl ?? "");
  const [token, setToken] = useState("");
  const canSubmit =
    serverUrl.trim() !== "" &&
    (token.trim() !== "" || preferences.gotifyTokenConfigured);

  const submit = async () => {
    const saved = await mutateAsync({
      ...(configured ? {} : { gotifyEnabled: true }),
      gotifyServerUrl: serverUrl,
      gotifyToken: token.trim() ? token : undefined,
    }).then(
      () => true,
      () => false,
    );
    if (saved) setToken("");
  };

  const disconnect = async () => {
    await mutateAsync({
      gotifyEnabled: false,
      gotifyServerUrl: null,
      gotifyToken: null,
    });
    onDisconnected();
  };

  return (
    <form
      className="space-y-4 p-4"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <ChannelField
          id={serverUrlId}
          label={t("settings:notificationsPage.serverUrl")}
        >
          <Input
            autoComplete="off"
            id={serverUrlId}
            onChange={(event) => setServerUrl(event.target.value)}
            placeholder={t(
              "settings:notificationsPage.gotifyServerPlaceholder",
            )}
            size="sm"
            type="url"
            value={serverUrl}
          />
        </ChannelField>
        <ChannelField
          id={tokenId}
          label={t("settings:notificationsPage.gotifyTokenLabel")}
          hint={
            preferences.gotifyTokenConfigured
              ? t("settings:notificationsPage.gotifyTokenHintConfigured", {
                  masked: preferences.maskedGotifyToken ?? "••••",
                })
              : t("settings:notificationsPage.gotifyTokenHintRequired")
          }
        >
          <Input
            autoComplete="off"
            id={tokenId}
            onChange={(event) => setToken(event.target.value)}
            placeholder={t("settings:notificationsPage.gotifyTokenPlaceholder")}
            size="sm"
            type="password"
            value={token}
          />
        </ChannelField>
      </div>
      {configured ? (
        <ChannelSendingRow
          channel="gotify"
          enabled={preferences.gotifyEnabled}
        />
      ) : null}
      <ChannelPanelFooter
        channelName={t("settings:notificationsPage.gotifyTitle")}
        configured={configured}
        onDisconnect={disconnect}
        submitDisabled={isPending || !canSubmit}
        submitLabel={
          configured
            ? t("settings:notificationsPage.saveChanges")
            : t("settings:notificationsPage.connectGotify")
        }
      />
    </form>
  );
}
