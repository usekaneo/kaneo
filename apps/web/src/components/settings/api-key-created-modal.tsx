import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Button } from "../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

type ApiKeyCreatedModalProps = {
  apiKey: string;
  keyName: string;
  open: boolean;
  onClose: () => void;
};

export function ApiKeyCreatedModal({
  apiKey,
  keyName,
  open,
  onClose,
}: ApiKeyCreatedModalProps) {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(apiKey);
    setCopied(true);
    toast.success(t("settings:apiKey.createdModal.toastCopied"));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[446px]">
        <DialogHeader>
          <DialogTitle>{t("settings:apiKey.createdModal.title")}</DialogTitle>
          <DialogDescription>
            {t("settings:apiKey.createdModal.description", {
              keyName,
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-6 py-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium">
                {t("settings:apiKey.createdModal.yourApiKey")}
              </p>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopy}
                className="h-7 gap-1.5 text-xs"
              >
                {copied ? (
                  <>
                    <Check className="h-3 w-3 text-success-foreground" />
                    {t("settings:apiKey.createdModal.copied")}
                  </>
                ) : (
                  <>
                    <Copy className="h-3 w-3" />
                    {t("settings:apiKey.createdModal.copy")}
                  </>
                )}
              </Button>
            </div>
            <div className="bg-sidebar border border-border rounded-sm p-2.5 max-h-24 overflow-y-auto">
              <code className="text-xs font-mono text-foreground break-all leading-relaxed">
                {apiKey}
              </code>
            </div>
          </div>

          <Alert>
            <AlertTitle>
              {t("settings:apiKey.createdModal.alertTitle")}
            </AlertTitle>
            <AlertDescription>
              {t("settings:apiKey.createdModal.alertDescription")}
            </AlertDescription>
          </Alert>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            onClick={onClose}
            disabled={!copied}
            className="h-8 text-xs w-full sm:w-auto"
          >
            {copied
              ? t("settings:apiKey.createdModal.done")
              : t("settings:apiKey.createdModal.copyToContinue")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
