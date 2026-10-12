import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import type { NotificationPreferences } from "@/fetchers/notification-preferences/get-notification-preferences";
import { useUpdateNotificationPreferences } from "@/hooks/mutations/notification-preferences/use-notification-preferences";
import { ChannelField } from "./channel-field";
import { ChannelPanelFooter } from "./channel-panel-footer";
import { ChannelSendingRow } from "./channel-sending-row";

type WebhookChannelPanelProps = {
  preferences: NotificationPreferences;
  onDisconnected: () => void;
};

export function WebhookChannelPanel({
  preferences,
  onDisconnected,
}: WebhookChannelPanelProps) {
  const { t } = useTranslation();
  const urlId = useId();
  const secretId = useId();
  const { mutateAsync, isPending } = useUpdateNotificationPreferences();
  const configured = preferences.webhookConfigured;
  const [url, setUrl] = useState(preferences.webhookUrl ?? "");
  const [secret, setSecret] = useState("");
  const canSubmit = url.trim() !== "";

  const submit = async () => {
    const saved = await mutateAsync({
      ...(configured ? {} : { webhookEnabled: true }),
      webhookUrl: url,
      webhookSecret: secret.trim() ? secret : undefined,
    }).then(
      () => true,
      () => false,
    );
    if (saved) setSecret("");
  };

  const disconnect = async () => {
    await mutateAsync({
      webhookEnabled: false,
      webhookUrl: null,
      webhookSecret: null,
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
          id={urlId}
          label={t("settings:notificationsPage.endpointUrl")}
        >
          <Input
            autoComplete="off"
            id={urlId}
            onChange={(event) => setUrl(event.target.value)}
            placeholder={t("settings:notificationsPage.webhookUrlPlaceholder")}
            size="sm"
            type="url"
            value={url}
          />
        </ChannelField>
        <ChannelField
          id={secretId}
          label={t("settings:notificationsPage.signingSecret")}
          optional
          hint={
            preferences.webhookSecretConfigured
              ? t("settings:notificationsPage.webhookSecretHintConfigured", {
                  masked: preferences.maskedWebhookSecret ?? "••••",
                })
              : t("settings:notificationsPage.webhookSecretHintOptional")
          }
        >
          <Input
            autoComplete="off"
            id={secretId}
            onChange={(event) => setSecret(event.target.value)}
            placeholder={t(
              "settings:notificationsPage.webhookSecretPlaceholder",
            )}
            size="sm"
            type="password"
            value={secret}
          />
        </ChannelField>
      </div>
      {configured ? (
        <ChannelSendingRow
          channel="webhook"
          enabled={preferences.webhookEnabled}
        />
      ) : null}
      <ChannelPanelFooter
        channelName={t("settings:notificationsPage.webhookTitle")}
        configured={configured}
        onDisconnect={disconnect}
        submitDisabled={isPending || !canSubmit}
        submitLabel={
          configured
            ? t("settings:notificationsPage.saveChanges")
            : t("settings:notificationsPage.connectWebhook")
        }
      />
    </form>
  );
}
