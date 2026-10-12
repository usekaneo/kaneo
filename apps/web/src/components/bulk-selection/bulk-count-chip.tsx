import { X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ShortcutKeys } from "@/components/shortcuts/shortcut-keys";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type BulkCountChipProps = {
  count: number;
  onClear: () => void;
};

export function BulkCountChip({ count, onClear }: BulkCountChipProps) {
  const { t } = useTranslation();

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-lg bg-accent ps-2.5 pe-1.5 font-medium text-[13px] text-foreground outline-none transition-colors hover:bg-accent/70 focus-visible:ring-2 focus-visible:ring-ring max-sm:h-9"
          />
        }
      >
        <span className="tabular-nums max-sm:hidden">
          {t("tasks:bulk.selectedCount", { count })}
        </span>
        <span className="tabular-nums sm:hidden">{count}</span>
        <span className="sr-only">{t("tasks:bulk.clearSelection")}</span>
        <X aria-hidden="true" className="size-3.5 text-muted-foreground" />
      </TooltipTrigger>
      <TooltipContent side="top" className="flex flex-col gap-1.5">
        <span className="flex items-center justify-between gap-4">
          {t("tasks:bulk.clearSelection")}
          <ShortcutKeys id="clearSelection" tone="tooltip" />
        </span>
        <span className="flex items-center justify-between gap-4">
          {t("tasks:bulk.selectAll")}
          <ShortcutKeys id="selectAll" tone="tooltip" />
        </span>
      </TooltipContent>
    </Tooltip>
  );
}
