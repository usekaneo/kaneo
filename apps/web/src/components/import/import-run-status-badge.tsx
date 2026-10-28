import { useTranslation } from "react-i18next";
import {
  getImportRunOutcome,
  getImportRunProgress,
} from "@/components/import/get-import-run-progress";
import { Badge } from "@/components/ui/badge";
import type { ImportRun } from "@/fetchers/import/get-import-run";

type ImportRunStatusBadgeProps = {
  run: Pick<ImportRun, "status" | "projects">;
};

export function ImportRunStatusBadge({ run }: ImportRunStatusBadgeProps) {
  const { t } = useTranslation();
  const progress = getImportRunProgress(run.projects);

  switch (getImportRunOutcome(run)) {
    case "running":
      return (
        <Badge variant="info">
          {t("settings:workspaceImport.status.importing", {
            current: progress.current,
            total: progress.total,
          })}
        </Badge>
      );
    case "warnings":
      return (
        <Badge variant="warning">
          {t("settings:workspaceImport.status.warnings", {
            count: progress.warnings,
          })}
        </Badge>
      );
    case "partial":
      return (
        <Badge variant="warning">
          {t("settings:workspaceImport.status.partial", {
            done: progress.completed,
            total: progress.total,
          })}
        </Badge>
      );
    case "failed":
      return (
        <Badge variant="error">
          {t("settings:workspaceImport.status.failed")}
        </Badge>
      );
    default:
      return (
        <Badge variant="success">
          {t("settings:workspaceImport.status.imported")}
        </Badge>
      );
  }
}
