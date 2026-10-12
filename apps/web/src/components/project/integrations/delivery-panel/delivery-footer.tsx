import { useState } from "react";
import { useTranslation } from "react-i18next";
import { IntegrationPanelFooter } from "@/components/project/integrations/panel/integration-panel-footer";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Button } from "@/components/ui/button";

type DeliveryFooterProps = {
  connected: boolean;
  busy: boolean;
  disconnecting: boolean;
  connectLabel: string;
  disconnectTitle: string;
  disconnectDescription: string;
  onDisconnect: () => Promise<boolean>;
};

export function DeliveryFooter({
  connected,
  busy,
  disconnecting,
  connectLabel,
  disconnectTitle,
  disconnectDescription,
  onDisconnect,
}: DeliveryFooterProps) {
  const { t } = useTranslation();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleConfirm = async () => {
    if (await onDisconnect()) {
      setConfirmOpen(false);
    }
  };

  return (
    <IntegrationPanelFooter
      start={
        connected ? (
          <>
            <Button
              disabled={busy}
              onClick={() => setConfirmOpen(true)}
              size="sm"
              type="button"
              variant="destructive-outline"
            >
              {t("settings:chatIntegrations.disconnect")}
            </Button>
            <ConfirmDialog
              confirmLabel={t("settings:chatIntegrations.disconnect")}
              description={disconnectDescription}
              onConfirm={() => void handleConfirm()}
              onOpenChange={setConfirmOpen}
              open={confirmOpen}
              pending={disconnecting}
              pendingLabel={t("settings:chatIntegrations.disconnecting")}
              title={disconnectTitle}
            />
          </>
        ) : null
      }
    >
      <Button disabled={busy} size="sm" type="submit">
        {connected ? t("settings:chatIntegrations.saveChanges") : connectLabel}
      </Button>
    </IntegrationPanelFooter>
  );
}
