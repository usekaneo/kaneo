import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Button } from "@/components/ui/button";
import { useDisconnectIntegration } from "@/hooks/mutations/use-disconnect-integration";
import { toast } from "@/lib/toast";
import type { IntegrationId } from "./integration-definitions";

export function DisabledIntegrationDisconnect({
  integrationId,
  projectId,
  name,
}: {
  integrationId: IntegrationId;
  projectId: string;
  name: string;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: disconnect, isPending } =
    useDisconnectIntegration(integrationId);

  const handleDisconnect = async () => {
    try {
      await disconnect(projectId);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("common:error.title"),
      );
    }
  };

  return (
    <>
      <Button
        size="sm"
        variant="destructive-outline"
        onClick={() => setOpen(true)}
      >
        {t("settings:chatIntegrations.disconnect")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("settings:chatIntegrations.disconnectTitle", {
          provider: name,
        })}
        confirmLabel={t("settings:chatIntegrations.disconnect")}
        pendingLabel={t("settings:chatIntegrations.disconnecting")}
        pending={isPending}
        onConfirm={() => void handleDisconnect()}
      />
    </>
  );
}
