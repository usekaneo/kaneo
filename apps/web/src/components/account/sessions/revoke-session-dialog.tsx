import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import type { ActiveSession } from "@/fetchers/user/session-types";
import { getSessionDeviceLabel } from "./get-session-device-label";

type RevokeSessionDialogProps = {
  session: ActiveSession | null;
  pending: boolean;
  onConfirm: () => void;
  onClose: () => void;
};

export function RevokeSessionDialog({
  session,
  pending,
  onConfirm,
  onClose,
}: RevokeSessionDialogProps) {
  const { t } = useTranslation();
  const device = session ? getSessionDeviceLabel(session, t) : "";

  return (
    <ConfirmDialog
      open={session !== null}
      onOpenChange={(open) => {
        if (!open && !pending) onClose();
      }}
      title={t("settings:sessions.revokeConfirmTitle", { device })}
      description={t("settings:sessions.revokeConfirmDescription")}
      confirmLabel={t("settings:sessions.revoke")}
      pendingLabel={t("settings:sessions.revoking")}
      pending={pending}
      onConfirm={onConfirm}
    />
  );
}
