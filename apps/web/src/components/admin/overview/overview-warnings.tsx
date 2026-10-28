import { Link } from "@tanstack/react-router";
import { TriangleAlertIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type { AdminOverview } from "@/fetchers/admin/overview-types";

const WARNING_KEYS = {
  smtp_not_configured: "settings:adminOverview.warnings.smtpNotConfigured",
  smtp_unreachable: "settings:adminOverview.warnings.smtpUnreachable",
  redis_unreachable: "settings:adminOverview.warnings.redisUnreachable",
  storage_incomplete: "settings:adminOverview.warnings.storageIncomplete",
  storage_unreachable: "settings:adminOverview.warnings.storageUnreachable",
  registration_without_email:
    "settings:adminOverview.warnings.registrationWithoutEmail",
  no_second_admin: "settings:adminOverview.warnings.noSecondAdmin",
} as const;

export function OverviewWarnings({
  warnings,
}: {
  warnings: AdminOverview["warnings"];
}) {
  const { t } = useTranslation();
  if (!warnings.length) return null;
  return (
    <SettingsSection title={t("settings:adminOverview.configurationWarnings")}>
      <SettingsCard>
        <ul className="divide-y divide-border">
          {warnings.map((warning) => (
            <li key={warning}>
              <Link
                to={
                  warning === "no_second_admin"
                    ? "/dashboard/settings/admin/users"
                    : "/dashboard/settings/admin/system"
                }
                className="flex items-start gap-3 px-4 py-3 text-sm hover:bg-accent"
              >
                <TriangleAlertIcon
                  aria-hidden="true"
                  className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
                />
                {t(WARNING_KEYS[warning])}
              </Link>
            </li>
          ))}
        </ul>
      </SettingsCard>
    </SettingsSection>
  );
}
