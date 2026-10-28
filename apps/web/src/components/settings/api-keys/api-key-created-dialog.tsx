import { CheckIcon, CopyIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogPanel,
  DialogPopup,
  DialogTitle,
} from "@/components/ui/dialog";
import { copyToClipboard } from "@/lib/copy-to-clipboard";
import { toast } from "@/lib/toast";

type ApiKeyCreatedDialogProps = {
  apiKey: string;
  open: boolean;
  onClose: () => void;
};

export function ApiKeyCreatedDialog({
  apiKey,
  open,
  onClose,
}: ApiKeyCreatedDialogProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (await copyToClipboard(apiKey)) {
      setCopied(true);
      return;
    }
    toast.error(t("settings:apiKey.createdModal.copyError"));
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <DialogPopup className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settings:apiKey.createdModal.title")}</DialogTitle>
          <DialogDescription>
            {t("settings:apiKey.createdModal.description")}
          </DialogDescription>
        </DialogHeader>
        <DialogPanel>
          <div className="flex items-center gap-2 rounded-lg border border-input bg-muted/40 py-1.5 ps-3 pe-1.5">
            <code className="min-w-0 flex-1 select-all truncate font-mono text-xs">
              {apiKey}
            </code>
            <Button
              type="button"
              variant="secondary"
              size="xs"
              onClick={handleCopy}
            >
              {copied ? (
                <>
                  <CheckIcon
                    aria-hidden="true"
                    className="text-success-foreground"
                  />
                  {t("settings:apiKey.createdModal.copied")}
                </>
              ) : (
                <>
                  <CopyIcon aria-hidden="true" />
                  {t("settings:apiKey.createdModal.copy")}
                </>
              )}
            </Button>
          </div>
        </DialogPanel>
        <DialogFooter>
          <Button type="button" onClick={onClose} disabled={!copied}>
            {t("settings:apiKey.createdModal.done")}
          </Button>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
