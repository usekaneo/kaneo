import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { USER_DIRECTORY_COLUMNS } from "./user-directory-columns";

const HEADER_CLASS = "shrink-0 text-xs text-muted-foreground";

export function UserDirectoryHead() {
  const { t } = useTranslation();

  return (
    <div role="row" className="hidden h-8 items-center gap-4 px-4 sm:flex">
      <div role="columnheader" className="flex-1 text-xs text-muted-foreground">
        {t("settings:adminUsers.columns.user")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, USER_DIRECTORY_COLUMNS.role)}
      >
        {t("settings:adminUsers.columns.role")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, USER_DIRECTORY_COLUMNS.status)}
      >
        {t("settings:adminUsers.columns.status")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, USER_DIRECTORY_COLUMNS.joined)}
      >
        {t("settings:adminUsers.columns.joined")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, USER_DIRECTORY_COLUMNS.actions)}
      >
        <span className="sr-only">
          {t("settings:adminUsers.columns.actions")}
        </span>
      </div>
    </div>
  );
}
