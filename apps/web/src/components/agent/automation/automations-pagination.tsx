import { ChevronLeft, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type AutomationsPaginationProps = {
  offset: number;
  pageSize: number;
  total: number;
  onOffsetChange: (offset: number) => void;
};

export function AutomationsPagination({
  offset,
  pageSize,
  total,
  onOffsetChange,
}: AutomationsPaginationProps) {
  const { t } = useTranslation();
  if (total <= pageSize) return null;
  return (
    <nav
      aria-label={t("agent:automations.pagination.label")}
      className="flex items-center justify-end gap-2 pt-3 text-muted-foreground text-xs"
    >
      <span className="tabular-nums">
        {t("agent:automations.pagination.range", {
          from: offset + 1,
          to: Math.min(offset + pageSize, total),
          total,
        })}
      </span>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("agent:automations.pagination.previous")}
        disabled={offset === 0}
        onClick={() => onOffsetChange(Math.max(0, offset - pageSize))}
      >
        <ChevronLeft aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        size="icon-xs"
        aria-label={t("agent:automations.pagination.next")}
        disabled={offset + pageSize >= total}
        onClick={() => onOffsetChange(offset + pageSize)}
      >
        <ChevronRight aria-hidden="true" />
      </Button>
    </nav>
  );
}
