import { PauseIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type PausedLinksCalloutProps = {
  count: number;
  open: boolean;
  onToggle: () => void;
};

export function PausedLinksCallout({
  count,
  open,
  onToggle,
}: PausedLinksCalloutProps) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-3 rounded-lg border border-warning/25 bg-warning/6 px-3 py-2">
      <PauseIcon
        aria-hidden="true"
        className="size-3.5 shrink-0 fill-current text-warning-foreground"
      />
      <p className="min-w-0 flex-1 text-[13px]">
        {t("settings:syncRules.pausedSummary", { count })}
      </p>
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={open}
        onClick={onToggle}
      >
        {open
          ? t("settings:syncRules.hidePaused")
          : t("settings:syncRules.reviewPaused")}
      </Button>
    </div>
  );
}
