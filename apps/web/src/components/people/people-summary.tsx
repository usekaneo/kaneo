import { useTranslation } from "react-i18next";
import type { CurrentSalary } from "@/fetchers/pay";
import type { PeopleOverview } from "@/fetchers/people/get-people-overview";
import type { Person } from "@/fetchers/people/list-people";
import { cn } from "@/lib/cn";
import { formatHours } from "@/lib/format-duration";
import { formatMoney } from "@/lib/money";

function Stat({
  label,
  value,
  hint,
  attention = false,
}: {
  label: string;
  value: string;
  hint?: string;
  attention?: boolean;
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div
        className={cn(
          "truncate text-lg font-semibold tabular-nums",
          attention && "text-destructive",
        )}
      >
        {value}
      </div>
      <div className="truncate text-xs text-muted-foreground">{label}</div>
      {hint && (
        <div className="truncate text-[11px] text-muted-foreground/80">
          {hint}
        </div>
      )}
    </div>
  );
}

// Company-wide totals above the admin People table.
export function PeopleSummary({
  people,
  overview,
  salaries,
  pendingInvites,
}: {
  people: Person[];
  overview: PeopleOverview;
  // Only passed when the viewer may see pay.
  salaries?: CurrentSalary[];
  pendingInvites: number;
}) {
  const { t, i18n } = useTranslation();
  const active = people.filter((p) => p.status !== "inactive");
  const present = people.filter((p) => p.clockedIn).length;
  const onLeave = overview.people.filter((p) => p.onLeaveToday).length;
  const openTasks = overview.people.reduce((sum, p) => sum + p.openTasks, 0);
  const overdue = overview.people.reduce((sum, p) => sum + p.overdueTasks, 0);
  const minutes = overview.people.reduce(
    (sum, p) => sum + p.workedMinutesThisMonth,
    0,
  );
  const departments = new Set(
    people.map((p) => p.departmentName).filter(Boolean),
  ).size;

  const monthly = (salaries ?? []).filter(
    (s) => s.type === "monthly" && s.amount !== null,
  );
  const hourly = (salaries ?? []).filter((s) => s.type === "hourly").length;
  const missing = (salaries ?? []).filter((s) => s.amount === null).length;
  const payroll = monthly.reduce((sum, s) => sum + (s.amount ?? 0), 0);

  return (
    <div
      className={cn(
        "grid grid-cols-2 divide-border rounded-lg border border-border sm:grid-cols-3 sm:divide-x",
        salaries ? "lg:grid-cols-6" : "lg:grid-cols-5",
      )}
    >
      <Stat
        label={t("people:summary.people")}
        value={String(active.length)}
        hint={[
          departments > 0
            ? t("people:summary.departments", { count: departments })
            : null,
          pendingInvites > 0
            ? t("people:summary.invited", { count: pendingInvites })
            : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <Stat
        label={t("people:summary.present")}
        value={`${present}/${active.length}`}
        hint={
          onLeave > 0
            ? t("people:summary.onLeave", { count: onLeave })
            : undefined
        }
      />
      <Stat
        label={t("people:summary.openTasks")}
        value={String(openTasks)}
        hint={
          overview.unassignedOpenTasks > 0
            ? t("people:summary.unassigned", {
                count: overview.unassignedOpenTasks,
              })
            : undefined
        }
      />
      <Stat
        label={t("people:summary.overdue")}
        value={String(overdue)}
        attention={overdue > 0}
      />
      <Stat
        label={t("people:summary.hoursThisMonth")}
        value={formatHours(minutes * 60)}
      />
      {salaries && (
        <Stat
          label={t("people:summary.monthlyPayroll")}
          value={formatMoney(payroll, overview.currency, i18n.language)}
          hint={[
            hourly > 0 ? t("people:summary.hourly", { count: hourly }) : null,
            missing > 0
              ? t("people:summary.noSalary", { count: missing })
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        />
      )}
    </div>
  );
}
