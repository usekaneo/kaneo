import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { getAuditActionLabel } from "@/components/admin/audit-log/get-audit-action-label";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type { AdminOverview } from "@/fetchers/admin/overview-types";
import { formatDateMedium, formatDateTime } from "@/lib/format";

export function RecentActions({
  actions,
}: {
  actions: AdminOverview["recentActions"];
}) {
  const { t } = useTranslation();
  return (
    <SettingsSection
      title={t("settings:adminOverview.recentActions")}
      action={
        <Link
          to="/dashboard/settings/admin/audit-log"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("settings:adminOverview.viewAuditLog")}
        </Link>
      }
    >
      <SettingsCard>
        {actions.length ? (
          <ul className="divide-y divide-border">
            {actions.map((entry) => (
              <li key={entry.id} className="flex items-start gap-3 px-4 py-3">
                <div className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">
                    {getAuditActionLabel(entry.action, t)}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {entry.targetLabel ?? entry.targetId ?? "—"}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {entry.actor.name ??
                      entry.actor.email ??
                      t("settings:adminAuditLog.unknownActor")}
                  </span>
                </div>
                <time
                  dateTime={entry.createdAt}
                  title={formatDateTime(entry.createdAt)}
                  className="shrink-0 text-xs text-muted-foreground tabular-nums"
                >
                  {formatDateMedium(entry.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {t("settings:adminOverview.noActions")}
          </p>
        )}
      </SettingsCard>
    </SettingsSection>
  );
}
