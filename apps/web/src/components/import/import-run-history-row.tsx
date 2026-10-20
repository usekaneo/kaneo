import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ImportRunStatusBadge } from "@/components/import/import-run-status-badge";
import { getImportSource } from "@/components/import/import-source-definitions";
import { ImportSourceLogoTile } from "@/components/import/import-source-logo-tile";
import { IMPORT_UNIT_COPY } from "@/components/import/import-unit-copy";
import type { ImportRun } from "@/fetchers/import/get-import-run";
import { formatRelativeTime } from "@/lib/format";

type ImportRunHistoryRowProps = {
  run: ImportRun;
};

export function ImportRunHistoryRow({ run }: ImportRunHistoryRowProps) {
  const { t } = useTranslation();
  const source = getImportSource(run.source);

  return (
    <li>
      <Link
        to="/dashboard/settings/workspace/import"
        search={{ run: run.id }}
        className="flex items-center gap-3.5 px-4 py-3.5 outline-none transition-colors hover:bg-accent/40 focus-visible:bg-accent/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
      >
        <ImportSourceLogoTile source={source} />
        <span className="min-w-0 flex-1 space-y-0.5">
          <span className="block truncate font-medium text-sm">
            {t(IMPORT_UNIT_COPY[source.unit].runTitle, {
              source: source.name,
              count: run.projects.length,
            })}
          </span>
          <span className="block truncate text-muted-foreground text-xs">
            {t("settings:workspaceImport.history.started", {
              time: formatRelativeTime(run.createdAt),
            })}
          </span>
        </span>
        <ImportRunStatusBadge run={run} />
        <ChevronRight
          aria-hidden="true"
          className="size-4 shrink-0 text-muted-foreground"
        />
      </Link>
    </li>
  );
}
