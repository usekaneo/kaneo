import { useTranslation } from "react-i18next";
import type { AdminAuditLogEntry } from "@/fetchers/admin/audit-log-types";
import { cn } from "@/lib/cn";
import { formatDate, formatDateMedium, formatDateTime } from "@/lib/format";
import { AUDIT_LOG_COLUMNS } from "./audit-log-columns";
import { getAuditActionLabel } from "./get-audit-action-label";
import { getAuditEntryDetail } from "./get-audit-entry-detail";
import { getAuditTargetTypeLabel } from "./get-audit-target-type-label";

type AuditLogRowProps = {
  entry: AdminAuditLogEntry;
};

const PRIMARY = "block truncate text-sm";
const SECONDARY = "block truncate text-xs text-muted-foreground";
const COLUMN = "hidden min-w-0 shrink-0 md:block";

export function AuditLogRow({ entry }: AuditLogRowProps) {
  const { t } = useTranslation();
  const time = formatDateTime(entry.createdAt);
  const actorName =
    entry.actor.name ??
    entry.actor.email ??
    t("settings:adminAuditLog.unknownActor");
  const actorDetail =
    entry.actor.id === null && entry.actor.name
      ? t("settings:adminAuditLog.deletedActor")
      : entry.actor.name
        ? entry.actor.email
        : null;
  const detail = getAuditEntryDetail(entry, t);
  const target = entry.targetLabel ?? entry.targetId ?? "—";
  const clock = formatDate(entry.createdAt, { timeStyle: "short" });

  return (
    <div role="row" className="flex items-start gap-4 px-4 py-3">
      <div role="cell" className="min-w-0 flex-1">
        <span className="block text-sm font-medium break-words">
          {getAuditActionLabel(entry.action, t)}
        </span>
        {detail ? <span className={SECONDARY}>{detail}</span> : null}
        <span className={cn(SECONDARY, "md:hidden")}>
          {t("settings:adminAuditLog.mobileSummary", {
            actor: actorName,
            target,
            time,
          })}
        </span>
      </div>
      <div role="cell" className={cn(COLUMN, AUDIT_LOG_COLUMNS.actor)}>
        <span className={PRIMARY}>{actorName}</span>
        {actorDetail ? <span className={SECONDARY}>{actorDetail}</span> : null}
      </div>
      <div role="cell" className={cn(COLUMN, AUDIT_LOG_COLUMNS.target)}>
        <span className={PRIMARY}>{target}</span>
        <span className={SECONDARY}>
          {getAuditTargetTypeLabel(entry.targetType, t)}
        </span>
      </div>
      <div role="cell" className={cn(COLUMN, AUDIT_LOG_COLUMNS.time)}>
        <time
          dateTime={entry.createdAt}
          title={time}
          className="block text-[13px] text-muted-foreground tabular-nums"
        >
          <span className="block truncate">
            {formatDateMedium(entry.createdAt)}
          </span>
          <span className="block truncate">{clock}</span>
        </time>
        {entry.ipAddress ? (
          <span
            className={cn(SECONDARY, "font-mono")}
            title={[entry.ipAddress, entry.userAgent]
              .filter(Boolean)
              .join("\n")}
          >
            {entry.ipAddress}
          </span>
        ) : null}
      </div>
    </div>
  );
}
