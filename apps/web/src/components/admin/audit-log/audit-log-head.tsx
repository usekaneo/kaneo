import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { AUDIT_LOG_COLUMNS } from "./audit-log-columns";

const HEADER_CLASS = "shrink-0 text-xs text-muted-foreground";

export function AuditLogHead() {
  const { t } = useTranslation();

  return (
    <div role="row" className="hidden h-8 items-center gap-4 px-4 md:flex">
      <div role="columnheader" className="flex-1 text-xs text-muted-foreground">
        {t("settings:adminAuditLog.columns.action")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, AUDIT_LOG_COLUMNS.actor)}
      >
        {t("settings:adminAuditLog.columns.actor")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, AUDIT_LOG_COLUMNS.target)}
      >
        {t("settings:adminAuditLog.columns.target")}
      </div>
      <div
        role="columnheader"
        className={cn(HEADER_CLASS, AUDIT_LOG_COLUMNS.time)}
      >
        {t("settings:adminAuditLog.columns.time")}
      </div>
    </div>
  );
}
