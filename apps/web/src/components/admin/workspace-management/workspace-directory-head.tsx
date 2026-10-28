import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { WORKSPACE_DIRECTORY_COLUMNS } from "./workspace-directory-columns";

const HEADER_CLASS = "shrink-0 text-xs text-muted-foreground";

export function WorkspaceDirectoryHead() {
  const { t } = useTranslation();

  return (
    <div role="row" className="hidden h-8 items-center gap-4 px-4 sm:flex">
      <div role="columnheader" className="flex-1 text-xs text-muted-foreground">
        {t("settings:adminWorkspaces.columns.workspace")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, WORKSPACE_DIRECTORY_COLUMNS.owners)}
      >
        {t("settings:adminWorkspaces.columns.owners")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, WORKSPACE_DIRECTORY_COLUMNS.members)}
      >
        {t("settings:adminWorkspaces.columns.members")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, WORKSPACE_DIRECTORY_COLUMNS.projects)}
      >
        {t("settings:adminWorkspaces.columns.projects")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, WORKSPACE_DIRECTORY_COLUMNS.created)}
      >
        {t("settings:adminWorkspaces.columns.created")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, WORKSPACE_DIRECTORY_COLUMNS.actions)}
      >
        <span className="sr-only">
          {t("settings:adminWorkspaces.columns.actions")}
        </span>
      </div>
    </div>
  );
}
