import type { ReactNode } from "react";
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

type RepositoryPickerDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  search: ReactNode;
  footerStart?: ReactNode;
  confirmLabel: string;
  confirmDisabled: boolean;
  onConfirm: () => void;
  children: ReactNode;
};

export function RepositoryPickerDialog({
  open,
  onOpenChange,
  title,
  description,
  search,
  footerStart,
  confirmLabel,
  confirmDisabled,
  onConfirm,
  children,
}: RepositoryPickerDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogPopup className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-lg">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
          <div className="pt-2">{search}</div>
        </DialogHeader>
        <DialogPanel className="min-h-64 px-3 sm:px-3">{children}</DialogPanel>
        <DialogFooter className="items-center sm:justify-between">
          <div className="text-xs text-muted-foreground">{footerStart}</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              {t("common:actions.cancel")}
            </Button>
            <Button
              type="button"
              disabled={confirmDisabled}
              onClick={onConfirm}
            >
              {confirmLabel}
            </Button>
          </div>
        </DialogFooter>
      </DialogPopup>
    </Dialog>
  );
}
