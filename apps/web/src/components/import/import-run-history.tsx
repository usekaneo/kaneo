import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ImportRunHistoryRow } from "@/components/import/import-run-history-row";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import useImportRuns from "@/hooks/queries/import/use-import-runs";

type ImportRunHistoryProps = {
  workspaceId: string;
};

export function ImportRunHistory({ workspaceId }: ImportRunHistoryProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const {
    data: runs,
    error,
    isLoading,
    isFetching,
    refetch,
  } = useImportRuns(workspaceId);
  const hasRunning = runs?.some((run) => run.status === "running") ?? false;
  const hadRunning = useRef(hasRunning);

  useEffect(() => {
    if (hadRunning.current && !hasRunning) {
      queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] });
    }
    hadRunning.current = hasRunning;
  }, [hasRunning, queryClient, workspaceId]);

  return (
    <section className="space-y-3">
      <SettingsSectionHeader
        title={t("settings:workspaceImport.history.title")}
        description={t("settings:workspaceImport.history.description")}
      />
      {isLoading ? (
        <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card px-4 py-3.5">
          <Skeleton className="size-8 rounded-lg" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      ) : error && !runs ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-card px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <p role="alert" className="text-muted-foreground text-sm">
            {t("settings:workspaceImport.history.loadError")}
          </p>
          <Button
            variant="outline"
            size="sm"
            className="self-start sm:self-auto"
            loading={isFetching}
            onClick={() => refetch()}
          >
            {t("settings:workspaceImport.retry")}
          </Button>
        </div>
      ) : !runs || runs.length === 0 ? (
        <p className="rounded-xl border border-border border-dashed px-4 py-6 text-center text-muted-foreground text-sm">
          {t("settings:workspaceImport.history.empty")}
        </p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {runs.map((run) => (
            <ImportRunHistoryRow key={run.id} run={run} />
          ))}
        </ul>
      )}
    </section>
  );
}
