import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { AdminOverview } from "@/fetchers/admin/overview-types";

export function OverviewStats({ data }: { data: AdminOverview }) {
  const { t, i18n } = useTranslation();
  const stats = [
    {
      label: t("settings:adminOverview.totalUsers"),
      value: data.users.total,
      to: "/dashboard/settings/admin/users",
    },
    {
      label: t("settings:adminOverview.activeUsers"),
      value: data.users.activeLast30Days,
      to: "/dashboard/settings/admin/users",
    },
    {
      label: t("settings:adminOverview.disabledUsers"),
      value: data.users.deactivated,
      to: "/dashboard/settings/admin/users",
    },
    {
      label: t("settings:adminOverview.workspaces"),
      value: data.workspaces.total,
      to: "/dashboard/settings/admin/workspaces",
    },
    {
      label: t("settings:adminOverview.archivedWorkspaces"),
      value: data.workspaces.archived,
      to: "/dashboard/settings/admin/workspaces",
    },
  ] as const;
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {stats.map((stat) => (
        <Link
          key={stat.label}
          to={stat.to}
          className="rounded-xl border bg-card p-4 transition-colors hover:bg-accent focus-visible:outline-ring"
        >
          <span className="block text-xs text-muted-foreground">
            {stat.label}
          </span>
          <span className="mt-3 block text-2xl font-semibold tracking-tight tabular-nums">
            {stat.value.toLocaleString(i18n.language)}
          </span>
        </Link>
      ))}
    </div>
  );
}
