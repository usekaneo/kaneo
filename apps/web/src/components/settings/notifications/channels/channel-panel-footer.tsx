import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Button } from "@/components/ui/button";

type ChannelPanelFooterProps = {
  channelName: string;
  configured: boolean;
  submitLabel: string;
  submitDisabled: boolean;
  onDisconnect: () => Promise<void>;
};

export function ChannelPanelFooter({
  channelName,
  configured,
  submitLabel,
  submitDisabled,
  onDisconnect,
}: ChannelPanelFooterProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const confirmDisconnect = async () => {
    setDisconnecting(true);
    try {
      await onDisconnect();
      setConfirmOpen(false);
    } catch {
      return;
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-0 flex-1 items-center">
        {configured ? (
          <Button
            onClick={() => setConfirmOpen(true)}
            size="sm"
            type="button"
            variant="destructive-outline"
          >
            {t("settings:notificationsPage.disconnect")}
          </Button>
        ) : null}
      </div>
      <Button disabled={submitDisabled} size="sm" type="submit">
        {submitLabel}
      </Button>
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("settings:notificationsPage.disconnectTitle", {
          channel: channelName,
        })}
        description={t("settings:notificationsPage.disconnectDescription", {
          channel: channelName,
        })}
        confirmLabel={t("settings:notificationsPage.disconnect")}
        pendingLabel={t("settings:notificationsPage.disconnecting")}
        pending={disconnecting}
        onConfirm={() => void confirmDisconnect()}
      />
    </div>
  );
}
