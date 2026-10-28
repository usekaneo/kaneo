import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

export function WebhookSecretDialog({
  secret,
  onClose,
}: {
  secret: string;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogPopup>
        <DialogHeader>
          <DialogTitle>{t("settings:adminWebhooks.secretTitle")}</DialogTitle>
        </DialogHeader>
        <DialogPanel>
          <Input
            aria-label={t("settings:adminWebhooks.signingSecret")}
            readOnly
            value={secret}
            className="font-mono text-xs"
            onFocus={(e) => e.target.select()}
          />
        </DialogPanel>
        <DialogFooter>
          <DialogClose render={<Button type="button" />}>
            {t("common:actions.close")}
          </DialogClose>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
