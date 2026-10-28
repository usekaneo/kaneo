import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { AutomationRuns } from "@/types/agent-automation";
import { AutomationRunRow } from "./automation-run-row";

type AutomationRunListProps = {
  runs: AutomationRuns | undefined;
  isPending: boolean;
  isError: boolean;
  onRetry: () => void;
  selectedId: string | undefined;
  onSelect: (runId: string) => void;
  monthCost: string | null;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function AutomationRunList({
  runs,
  isPending,
  isError,
  onRetry,
  selectedId,
  onSelect,
  monthCost,
  page,
  pageSize,
  onPageChange,
}: AutomationRunListProps) {
  const { t } = useTranslation();
  const hasOlder = (runs?.length ?? 0) >= pageSize;

  return (
    <section className="flex min-w-0 flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2 border-border/80 border-b pb-2">
        <h2 className="font-semibold text-[15px] text-foreground">
          {t("agent:automations.runs.title")}
        </h2>
        {monthCost && (
          <span className="font-mono text-[11px] text-muted-foreground">
            {t("agent:automations.monthCost", { cost: monthCost })}
          </span>
        )}
      </div>
      {isPending ? (
        <p role="status" className="py-3 text-muted-foreground text-sm">
          {t("common:empty.loading")}
        </p>
      ) : isError ? (
        <div className="flex items-center gap-3 py-3">
          <p role="alert" className="text-muted-foreground text-sm">
            {t("agent:automations.runs.loadError")}
          </p>
          <Button variant="outline" size="sm" onClick={onRetry}>
            {t("common:error.tryAgain")}
          </Button>
        </div>
      ) : runs?.length === 0 ? (
        <p className="py-3 text-muted-foreground text-sm">
          {t("agent:automations.runs.empty")}
        </p>
      ) : (
        <ul className="-mx-3 flex flex-col gap-0.5">
          {runs?.map((run) => (
            <AutomationRunRow
              key={run.id}
              run={run}
              selected={run.id === selectedId}
              onSelect={() => onSelect(run.id)}
            />
          ))}
        </ul>
      )}
      {(page > 0 || hasOlder) && (
        <div className="flex justify-between gap-2 pt-1">
          <Button
            variant="ghost"
            size="xs"
            disabled={page === 0}
            onClick={() => onPageChange(page - 1)}
          >
            {t("agent:automations.runs.newer")}
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={!hasOlder}
            onClick={() => onPageChange(page + 1)}
          >
            {t("agent:automations.runs.older")}
          </Button>
        </div>
      )}
    </section>
  );
}
