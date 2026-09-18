import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { AttendanceDay } from "@/fetchers/attendance";
import { useAttendanceDays } from "@/hooks/queries/attendance/use-attendance";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatHours } from "@/lib/format-duration";
import { zonedClock, zonedDay } from "@/lib/zoned-time";
import { AttendanceTable } from "./attendance-table";
import { dayStatusLabel, StatusLegend, statusTone } from "./day-status";
import { EditDayDialog } from "./edit-day-dialog";

function monthBounds(year: number, month: number) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    from: `${year}-${pad(month)}-01`,
    to: `${year}-${pad(month)}-${pad(last)}`,
  };
}

type Props = {
  workspaceId: string;
  userId?: string;
};

function Tile({
  label,
  value,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  tone?: string;
}) {
  return (
    <div className="rounded-lg border border-border px-3 py-2">
      <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
        {tone && (
          <span className={cn("size-2 rounded-full", tone)} aria-hidden />
        )}
        {label}
      </div>
      <div className="font-semibold text-lg tabular-nums">{value}</div>
    </div>
  );
}

// Sunday first, as on most calendars in Bangladesh.
const WEEK = [0, 1, 2, 3, 4, 5, 6];

// One person's month: a calendar you can read at a glance, the numbers that
// matter, and the day-by-day detail below.
export function AttendanceMonth({ workspaceId, userId }: Props) {
  const { t, i18n } = useTranslation();
  const { canManagePeople } = useWorkspacePermission();
  const { data: company } = useCompanySettings(workspaceId);
  const todayLocal = zonedDay(new Date(), company?.timezone ?? "UTC");
  const [picked, setPicked] = useState<{ year: number; month: number } | null>(
    null,
  );
  const period = picked ?? {
    year: Number(todayLocal.slice(0, 4)),
    month: Number(todayLocal.slice(5, 7)),
  };
  const [editing, setEditing] = useState<AttendanceDay | null>(null);

  const bounds = monthBounds(period.year, period.month);
  const { data } = useAttendanceDays({ workspaceId, userId, ...bounds });
  const timeZone = data?.timeZone ?? company?.timezone ?? "UTC";

  const shift = (delta: number) => {
    const index = period.year * 12 + (period.month - 1) + delta;
    setPicked({ year: Math.floor(index / 12), month: (index % 12) + 1 });
  };

  const title = new Intl.DateTimeFormat(i18n.language, {
    month: "long",
    year: "numeric",
  }).format(new Date(Date.UTC(period.year, period.month - 1, 15)));

  const weekdayNames = useMemo(
    () =>
      WEEK.map((d) =>
        new Intl.DateTimeFormat(i18n.language, {
          weekday: "short",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(2023, 0, 1 + d))),
      ),
    [i18n.language],
  );

  const days = data?.days ?? [];
  const leading = days[0]
    ? new Date(`${days[0].day}T12:00:00Z`).getUTCDay()
    : 0;

  const rows = useMemo(
    () =>
      days
        // Future days add nothing but noise to the table.
        .filter((d) => !data || d.day <= data.today)
        .map((d) => ({
          ...d,
          key: d.day,
          label: new Intl.DateTimeFormat(i18n.language, {
            weekday: "short",
            day: "numeric",
            month: "short",
            timeZone: "UTC",
          }).format(new Date(`${d.day}T12:00:00Z`)),
        }))
        .reverse(),
    [days, data, i18n.language],
  );

  const canEdit = Boolean(canManagePeople()) && Boolean(userId);
  const isCurrent = todayLocal.startsWith(
    `${period.year}-${String(period.month).padStart(2, "0")}`,
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold text-base">{title}</h3>
        <div className="flex items-center">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("attendance:month.previous")}
            onClick={() => shift(-1)}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="ghost"
            size="xs"
            disabled={isCurrent}
            onClick={() => setPicked(null)}
          >
            {t("attendance:month.thisMonth")}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("attendance:month.next")}
            onClick={() => shift(1)}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      {data && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Tile
            label={t("attendance:status.present")}
            value={data.totals.presentDays}
            tone={statusTone.present.dot}
          />
          <Tile
            label={t("attendance:status.late")}
            value={data.totals.lateDays}
            tone={statusTone.late.dot}
          />
          <Tile
            label={t("attendance:status.absent")}
            value={data.totals.absentDays}
            tone={statusTone.absent.dot}
          />
          <Tile
            label={t("attendance:status.leave")}
            value={data.totals.leaveDays}
            tone={statusTone.leave.dot}
          />
          <Tile
            label={t("attendance:table.worked")}
            value={formatHours(data.totals.workedMinutes * 60)}
          />
          <Tile
            label={t("attendance:table.overtime")}
            value={formatHours(data.totals.overtimeMinutes * 60)}
          />
        </div>
      )}

      <div className="space-y-2">
        <div className="grid grid-cols-7 gap-1 text-center text-muted-foreground text-xs">
          {weekdayNames.map((name) => (
            <div key={name} className="py-1">
              {name}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leading }, (_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: fixed blank cells
            <div key={`blank-${i}`} />
          ))}
          {days.map((day) => {
            const tone = statusTone[day.status];
            const label = dayStatusLabel(t, day.status);
            const clickable = canEdit && day.day <= (data?.today ?? "");
            return (
              <button
                key={day.day}
                type="button"
                disabled={!clickable}
                onClick={() => setEditing(day)}
                title={`${day.day} · ${label}`}
                aria-label={`${day.day}: ${label}`}
                className={cn(
                  "flex min-h-16 flex-col items-start gap-0.5 rounded-lg border p-1.5 text-left text-xs transition-colors sm:min-h-20 sm:p-2",
                  tone.cell,
                  clickable && "hover:ring-1 hover:ring-primary/40",
                  !clickable && "cursor-default",
                  day.day === data?.today && "ring-2 ring-primary/60",
                )}
              >
                <span className="font-semibold text-sm">
                  {Number(day.day.slice(8))}
                </span>
                {day.firstIn ? (
                  <span className="hidden tabular-nums sm:block">
                    {zonedClock(day.firstIn, timeZone)}
                    {day.open
                      ? " →"
                      : day.lastOut
                        ? `–${zonedClock(day.lastOut, timeZone)}`
                        : ""}
                  </span>
                ) : (
                  day.status !== "upcoming" &&
                  day.status !== "off" &&
                  day.status !== "notJoined" && (
                    <span className="hidden truncate sm:block">{label}</span>
                  )
                )}
                {day.workedMinutes > 0 && (
                  <span className="mt-auto font-medium tabular-nums">
                    {formatHours(day.workedMinutes * 60)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <StatusLegend
          statuses={[
            "present",
            "late",
            "absent",
            "leave",
            "off",
            ...(days.some((d) => d.status === "notJoined")
              ? (["notJoined"] as const)
              : []),
          ]}
        />
      </div>

      {data && rows.length > 0 && (
        <AttendanceTable
          rows={rows}
          timeZone={timeZone}
          firstColumn={t("attendance:table.day")}
          totals={data.totals}
          onRowClick={canEdit ? (row) => setEditing(row) : undefined}
        />
      )}
      {canEdit && userId && (
        <EditDayDialog
          open={editing !== null}
          onClose={() => setEditing(null)}
          workspaceId={workspaceId}
          userId={userId}
          timeZone={timeZone}
          day={editing}
        />
      )}
    </div>
  );
}
