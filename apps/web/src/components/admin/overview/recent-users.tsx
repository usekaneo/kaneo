import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { DirectoryAvatar } from "@/components/admin/directory/directory-avatar";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsSection } from "@/components/settings/settings-section";
import type { AdminOverview } from "@/fetchers/admin/overview-types";
import { formatDateMedium, formatDateTime } from "@/lib/format";

export function RecentUsers({
  users,
}: {
  users: AdminOverview["recentUsers"];
}) {
  const { t } = useTranslation();
  return (
    <SettingsSection
      title={t("settings:adminOverview.recentUsers")}
      action={
        <Link
          to="/dashboard/settings/admin/users"
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          {t("settings:adminOverview.viewUsers")}
        </Link>
      }
    >
      <SettingsCard>
        {users.length ? (
          <ul className="divide-y divide-border">
            {users.map((user) => (
              <li key={user.id} className="flex items-center gap-3 px-4 py-3">
                <DirectoryAvatar name={user.name} image={user.image} />
                <div className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {user.name}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.email}
                  </span>
                </div>
                <time
                  dateTime={user.createdAt}
                  title={formatDateTime(user.createdAt)}
                  className="shrink-0 text-xs text-muted-foreground tabular-nums"
                >
                  {formatDateMedium(user.createdAt)}
                </time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-4 text-sm text-muted-foreground">
            {t("settings:adminOverview.noUsers")}
          </p>
        )}
      </SettingsCard>
    </SettingsSection>
  );
}
