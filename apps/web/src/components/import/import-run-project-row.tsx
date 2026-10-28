import { Link } from "@tanstack/react-router";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ImportRunStatusIcon } from "@/components/import/import-run-status-icon";
import {
  IMPORT_COUNT_LABEL_KEYS,
  summarizeImportCounts,
} from "@/components/import/summarize-import-counts";
import { Badge, badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import type { ImportRunProject } from "@/fetchers/import/get-import-run";
import { cn } from "@/lib/cn";

type ImportRunProjectRowProps = {
  project: ImportRunProject;
  message: string | null;
  workspaceId: string;
};

export function ImportRunProjectRow({
  project,
  message,
  workspaceId,
}: ImportRunProjectRowProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const warnings =
    project.status === "completed" ? [...new Set(project.warnings)] : [];

  const detail = (() => {
    switch (project.status) {
      case "completed": {
        const parts = summarizeImportCounts(project.counts).map((part) =>
          t(IMPORT_COUNT_LABEL_KEYS[part.key], { count: part.count }),
        );
        return parts.length > 0
          ? parts.join(" · ")
          : t("settings:workspaceImport.run.noTasks");
      }
      case "running":
        return message ?? t("settings:workspaceImport.run.starting");
      case "pending":
        return t("settings:workspaceImport.run.waiting");
      default:
        return project.error ?? t("settings:workspaceImport.run.notImported");
    }
  })();

  const trailing = (() => {
    switch (project.status) {
      case "completed":
        return project.projectId ? (
          <Button
            variant="outline"
            size="sm"
            className="w-18"
            aria-label={t("settings:workspaceImport.run.openProject", {
              name: project.name,
            })}
            render={
              <Link
                to="/dashboard/workspace/$workspaceId/project/$projectId/board"
                params={{ workspaceId, projectId: project.projectId }}
              />
            }
          >
            {t("settings:workspaceImport.run.open")}
          </Button>
        ) : null;
      case "running":
        return (
          <Badge variant="info">
            {t("settings:workspaceImport.run.importingBadge")}
          </Badge>
        );
      case "pending":
        return (
          <Badge variant="outline">
            {t("settings:workspaceImport.run.queued")}
          </Badge>
        );
      default:
        return (
          <Badge variant="error">
            {t("settings:workspaceImport.run.failedBadge")}
          </Badge>
        );
    }
  })();

  return (
    <li>
      <Collapsible open={open} onOpenChange={setOpen}>
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          <ImportRunStatusIcon status={project.status} />
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate font-medium text-sm",
                project.status === "pending" && "text-muted-foreground",
              )}
            >
              {project.name}
            </p>
            <p
              className={cn(
                "text-xs",
                project.status === "failed"
                  ? "text-destructive-foreground"
                  : "text-muted-foreground",
              )}
            >
              {detail}
            </p>
          </div>
          {warnings.length > 0 ? (
            <CollapsibleTrigger
              className={badgeVariants({
                variant: "warning",
                className: "[&[data-panel-open]>svg]:rotate-180",
              })}
            >
              {t("settings:workspaceImport.run.warnings", {
                count: warnings.length,
              })}
              <ChevronDown
                aria-hidden="true"
                className="transition-transform duration-200"
              />
            </CollapsibleTrigger>
          ) : null}
          <div className="flex w-22 shrink-0 justify-end">{trailing}</div>
        </div>
        {warnings.length > 0 ? (
          <CollapsiblePanel>
            <ul className="space-y-1.5 pe-4 ps-12.5 pb-3.5">
              {warnings.map((warning) => (
                <li key={warning} className="flex items-start gap-2 text-xs">
                  <span
                    aria-hidden="true"
                    className="mt-1.5 size-1 shrink-0 rounded-full bg-warning"
                  />
                  <span>{warning}</span>
                </li>
              ))}
            </ul>
          </CollapsiblePanel>
        ) : null}
      </Collapsible>
    </li>
  );
}
