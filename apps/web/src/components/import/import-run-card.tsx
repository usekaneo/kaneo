import { useTranslation } from "react-i18next";
import type { ImportRunProgress } from "@/components/import/get-import-run-progress";
import { ImportRunProjectRow } from "@/components/import/import-run-project-row";
import { importRunMinutes } from "@/components/import/import-run-minutes";
import type { ImportSourceDefinition } from "@/components/import/import-source-definitions";
import { IMPORT_UNIT_COPY } from "@/components/import/import-unit-copy";
import {
  IMPORT_COUNT_LABEL_KEYS,
  summarizeImportCounts,
  sumImportCounts,
  TOTAL_COUNT_KEYS,
} from "@/components/import/summarize-import-counts";
import { Progress } from "@/components/ui/progress";
import type { ImportRun } from "@/fetchers/import/get-import-run";
import { formatRelativeTime } from "@/lib/format";

type ImportRunCardProps = {
  run: ImportRun;
  source: ImportSourceDefinition;
  progress: ImportRunProgress;
};

export function ImportRunCard({ run, source, progress }: ImportRunCardProps) {
  const { t } = useTranslation();
  const running = run.status === "running";
  const copy = IMPORT_UNIT_COPY[source.unit];
  const totals = summarizeImportCounts(
    sumImportCounts(run.projects),
    TOTAL_COUNT_KEYS,
  ).map((part) => t(IMPORT_COUNT_LABEL_KEYS[part.key], { count: part.count }));
  const minutes = importRunMinutes(run.createdAt, run.finishedAt);

  const headline = running
    ? t(copy.progress, { count: progress.total, done: progress.completed })
    : totals.length > 0
      ? t("settings:workspaceImport.run.totals", { parts: totals })
      : t("settings:workspaceImport.run.nothingImported");

  const meta = running
    ? t("settings:workspaceImport.run.started", {
        time: formatRelativeTime(run.createdAt),
      })
    : minutes === null
      ? null
      : minutes < 1
        ? t("settings:workspaceImport.run.tookUnderMinute")
        : t("settings:workspaceImport.run.took", { count: minutes });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <div className="space-y-3 px-4 py-3.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p role="status" aria-live="polite" className="font-medium text-sm">
            {headline}
          </p>
          {meta ? (
            <p className="text-muted-foreground text-xs">{meta}</p>
          ) : null}
        </div>
        {running ? (
          <Progress value={progress.percent} aria-label={headline} />
        ) : null}
      </div>
      <ul className="divide-y divide-border border-border border-t">
        {run.projects.map((project) => (
          <ImportRunProjectRow
            key={project.sourceId}
            project={project}
            message={project.status === "running" ? run.message : null}
            workspaceId={run.workspaceId}
          />
        ))}
      </ul>
    </div>
  );
}
