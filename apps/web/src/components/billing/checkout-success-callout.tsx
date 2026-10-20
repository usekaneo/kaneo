import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { DrawnCheck } from "./drawn-check";

export function CheckoutSuccessCallout({
  onDismiss,
}: {
  onDismiss: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="flex items-center gap-3 rounded-xl border border-success/24 bg-success/8 p-4 text-success-foreground transition-[opacity,translate,scale] duration-300 ease-out starting:translate-y-2 starting:scale-98 starting:opacity-0 motion-reduce:starting:translate-y-0 motion-reduce:starting:scale-100 dark:bg-success/12"
    >
      <DrawnCheck />
      <div className="min-w-0 flex-1 space-y-0.5">
        <p className="font-medium text-sm">
          {t("settings:billing.checkoutSuccess.title")}
        </p>
        <p className="text-xs opacity-80">
          {t("settings:billing.checkoutSuccess.description")}
        </p>
      </div>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={t("common:actions.close")}
        onClick={onDismiss}
        className="shrink-0 text-success-foreground"
      >
        <X />
      </Button>
    </div>
  );
}
