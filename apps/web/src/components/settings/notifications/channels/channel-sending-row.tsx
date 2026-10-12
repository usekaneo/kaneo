import { useId } from "react";
import { useTranslation } from "react-i18next";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type { UpdateNotificationPreferencesRequest } from "@/fetchers/notification-preferences/update-notification-preferences";
import { useUpdateNotificationPreferences } from "@/hooks/mutations/notification-preferences/use-notification-preferences";
import type { ExternalChannelId } from "../notification-channels";

const ENABLED_KEYS = {
  gotify: "gotifyEnabled",
  ntfy: "ntfyEnabled",
  webhook: "webhookEnabled",
} as const satisfies Record<
  ExternalChannelId,
  keyof UpdateNotificationPreferencesRequest
>;

type ChannelSendingRowProps = {
  channel: ExternalChannelId;
  enabled: boolean;
};

export function ChannelSendingRow({
  channel,
  enabled,
}: ChannelSendingRowProps) {
  const { t } = useTranslation();
  const id = useId();
  const { mutate, isPending, variables } = useUpdateNotificationPreferences();
  const key = ENABLED_KEYS[channel];
  const checked = isPending ? (variables?.[key] ?? enabled) : enabled;

  const setSending = (next: boolean) => {
    const payload: UpdateNotificationPreferencesRequest = {};
    payload[key] = next;
    mutate(payload);
  };

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="min-w-0 space-y-0.5">
        <Label htmlFor={id}>
          {t("settings:notificationsPage.sendingLabel")}
        </Label>
        <p className="text-xs text-muted-foreground">
          {t("settings:notificationsPage.sendingDescription")}
        </p>
      </div>
      <Switch
        checked={checked}
        disabled={isPending}
        id={id}
        onCheckedChange={setSending}
      />
    </div>
  );
}
