import { ArchiveIcon, ArchiveRestoreIcon, Trash2Icon } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  type RowAction,
  RowActionsMenu,
} from "@/components/settings/row-actions-menu";
import { Button } from "@/components/ui/button";
import type { AdminWorkspace } from "@/fetchers/admin/workspace-types";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import type { PendingWorkspaceAction } from "./pending-workspace-action";
import { WorkspaceArchivedBadge } from "./workspace-archived-badge";
import { WORKSPACE_DIRECTORY_COLUMNS } from "./workspace-directory-columns";
import { WorkspaceOwners } from "./workspace-owners";

type WorkspaceDirectoryRowProps = {
  workspace: AdminWorkspace;
  onManage: () => void;
  onAction: (type: PendingWorkspaceAction["type"]) => void;
};

const CELL_CLASS =
  "hidden shrink-0 text-[13px] text-muted-foreground tabular-nums sm:block";

export function WorkspaceDirectoryRow({
  workspace,
  onManage,
  onAction,
}: WorkspaceDirectoryRowProps) {
  const { t } = useTranslation();
  const isArchived = workspace.archivedAt !== null;
  const actions: RowAction[] = [
    isArchived
      ? {
          id: "restore",
          label: t("settings:adminWorkspaces.actions.restore"),
          icon: ArchiveRestoreIcon,
          onSelect: () => onAction("restore"),
        }
      : {
          id: "archive",
          label: t("settings:adminWorkspaces.actions.archive"),
          icon: ArchiveIcon,
          onSelect: () => onAction("archive"),
        },
    {
      id: "delete",
      label: t("common:actions.delete"),
      icon: Trash2Icon,
      destructive: true,
      onSelect: () => onAction("delete"),
    },
  ];

  return (
    <div role="row" className="flex items-center gap-4 px-4 py-3">
      <div role="cell" className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">
          {workspace.name}
        </span>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate font-mono text-xs text-muted-foreground">
            {workspace.slug}
          </span>
          {isArchived ? <WorkspaceArchivedBadge /> : null}
        </div>
        <div className="mt-1.5 flex min-w-0 items-center gap-2 text-muted-foreground sm:hidden">
          <WorkspaceOwners owners={workspace.owners} />
          <span className="shrink-0 text-xs">
            {t("settings:adminWorkspaces.members.count", {
              count: workspace.memberCount,
            })}
          </span>
        </div>
      </div>
      <div
        role="cell"
        className={cn(
          "hidden min-w-0 shrink-0 sm:flex",
          WORKSPACE_DIRECTORY_COLUMNS.owners,
        )}
      >
        <WorkspaceOwners owners={workspace.owners} />
      </div>
      <div
        role="cell"
        className={cn(CELL_CLASS, WORKSPACE_DIRECTORY_COLUMNS.members)}
      >
        {workspace.memberCount}
      </div>
      <div
        role="cell"
        className={cn(CELL_CLASS, WORKSPACE_DIRECTORY_COLUMNS.projects)}
      >
        {workspace.projectCount}
      </div>
      <div
        role="cell"
        className={cn(CELL_CLASS, WORKSPACE_DIRECTORY_COLUMNS.created)}
      >
        {formatDateMedium(workspace.createdAt)}
      </div>
      <div
        role="cell"
        className={cn(
          "flex shrink-0 items-center justify-end gap-1",
          WORKSPACE_DIRECTORY_COLUMNS.actions,
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          aria-label={t("settings:adminWorkspaces.manageLabel", {
            name: workspace.name,
          })}
          onClick={onManage}
        >
          {t("settings:adminWorkspaces.manage")}
        </Button>
        <RowActionsMenu
          label={t("settings:adminWorkspaces.actions.open", {
            name: workspace.name,
          })}
          actions={actions}
        />
      </div>
    </div>
  );
}
