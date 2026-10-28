import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { useUpdateNotificationPreferences } from "@/hooks/mutations/notification-preferences/use-notification-preferences";
import { ChannelField } from "./channel-field";
import { ChannelPanelFooter } from "./channel-panel-footer";
import { ChannelSendingRow } from "./channel-sending-row";

type NtfyChannelPanelProps = {
  preferences: NotificationPreferences;
  onDisconnected: () => void;
};

export function NtfyChannelPanel({
  preferences,
  onDisconnected,
}: NtfyChannelPanelProps) {
  const { t } = useTranslation();
  const serverUrlId = useId();
  const topicId = useId();
  const tokenId = useId();
  const { mutateAsync, isPending } = useUpdateNotificationPreferences();
  const configured = preferences.ntfyConfigured;
  const [serverUrl, setServerUrl] = useState(preferences.ntfyServerUrl ?? "");
  const [topic, setTopic] = useState(preferences.ntfyTopic ?? "");
  const [token, setToken] = useState("");
  const canSubmit = serverUrl.trim() !== "" && topic.trim() !== "";

  const submit = async () => {
    const saved = await mutateAsync({
      ...(configured ? {} : { ntfyEnabled: true }),
      ntfyServerUrl: serverUrl,
      ntfyTopic: topic,
      ntfyToken: token.trim() ? token : undefined,
    }).then(
      () => true,
      () => false,
    );
    if (saved) setToken("");
  };

  const disconnect = async () => {
    await mutateAsync({
      ntfyEnabled: false,
      ntfyServerUrl: null,
      ntfyTopic: null,
      ntfyToken: null,
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
            placeholder={t("settings:notificationsPage.ntfyServerPlaceholder")}
            size="sm"
            type="url"
            value={serverUrl}
          />
        </ChannelField>
        <ChannelField
          id={topicId}
          label={t("settings:notificationsPage.topic")}
        >
          <Input
            autoComplete="off"
            id={topicId}
            onChange={(event) => setTopic(event.target.value)}
            placeholder={t("settings:notificationsPage.ntfyTopicPlaceholder")}
            size="sm"
            value={topic}
          />
        </ChannelField>
        <ChannelField
          className="sm:col-span-2"
          id={tokenId}
          label={t("settings:notificationsPage.token")}
          optional
          hint={
            preferences.ntfyTokenConfigured
              ? t("settings:notificationsPage.ntfyTokenHintConfigured", {
                  masked: preferences.maskedNtfyToken ?? "••••",
                })
              : t("settings:notificationsPage.ntfyTokenHintOptional")
          }
        >
          <Input
            autoComplete="off"
            id={tokenId}
            onChange={(event) => setToken(event.target.value)}
            placeholder={t("settings:notificationsPage.ntfyTokenPlaceholder")}
            size="sm"
            type="password"
            value={token}
          />
        </ChannelField>
      </div>
      {configured ? (
        <ChannelSendingRow channel="ntfy" enabled={preferences.ntfyEnabled} />
      ) : null}
      <ChannelPanelFooter
        channelName={t("settings:notificationsPage.ntfyTitle")}
        configured={configured}
        onDisconnect={disconnect}
        submitDisabled={isPending || !canSubmit}
        submitLabel={
          configured
            ? t("settings:notificationsPage.saveChanges")
            : t("settings:notificationsPage.connectNtfy")
        }
      />
    </form>
  );
}
