import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTeamAttendance } from "@/hooks/queries/attendance/use-attendance";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import { cn } from "@/lib/cn";
import { addDaysToDay, zonedDay } from "@/lib/zoned-time";
import { AttendanceTable } from "./attendance-table";
import { type DayStatus, dayStatusLabel, statusTone } from "./day-status";

// Late people were present too; the tiles count them once, under Late.
const TILES: DayStatus[] = ["present", "late", "leave", "absent", "pending"];

// Everyone's day on one screen, for people who look after a team.
export function TeamAttendanceDay({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { data: company } = useCompanySettings(workspaceId);
  const timeZone = company?.timezone ?? "UTC";
  const today = zonedDay(new Date(), timeZone);
  const [picked, setPicked] = useState<string | null>(null);
  const [filter, setFilter] = useState<DayStatus | null>(null);
  const day = picked ?? today;
  const { data: rows = [] } = useTeamAttendance(
    workspaceId,
    day,
    Boolean(company),
  );

  const label = new Intl.DateTimeFormat(i18n.language, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  }).format(new Date(`${day}T12:00:00Z`));

  const counts = new Map<DayStatus, number>();
  for (const row of rows) {
    counts.set(row.status, (counts.get(row.status) ?? 0) + 1);
  }
  const shown = filter ? rows.filter((r) => r.status === filter) : rows;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-semibold text-base">{label}</p>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("attendance:team.previousDay")}
            onClick={() => setPicked(addDaysToDay(day, -1))}
          >
            <ChevronLeft />
          </Button>
          <Input
            type="date"
            value={day}
            max={today}
            aria-label={t("attendance:team.pickDay")}
            className="h-7 w-36 text-xs"
            onChange={(e) =>
              e.target.value &&
              setPicked(e.target.value > today ? null : e.target.value)
            }
          />
          <Button
            variant="ghost"
            size="xs"
            disabled={day === today}
            onClick={() => setPicked(null)}
          >
            {t("attendance:team.today")}
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("attendance:team.nextDay")}
            disabled={day >= today}
            onClick={() => setPicked(addDaysToDay(day, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {TILES.filter((s) => s !== "pending" || day === today).map((status) => {
          const active = filter === status;
          return (
            <button
              key={status}
              type="button"
              aria-pressed={active}
              onClick={() => setFilter(active ? null : status)}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-colors hover:bg-accent/60",
                active ? statusTone[status].cell : "border-border",
              )}
            >
              <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                <span
                  className={cn("size-2 rounded-full", statusTone[status].dot)}
                  aria-hidden
                />
                {dayStatusLabel(t, status)}
              </div>
              <div className="font-semibold text-2xl tabular-nums">
                {counts.get(status) ?? 0}
              </div>
            </button>
          );
        })}
      </div>

      {filter && (
        <p className="text-muted-foreground text-xs">
          {t("attendance:team.filtered", {
            status: dayStatusLabel(t, filter),
            count: shown.length,
          })}{" "}
          <button
            type="button"
            className="underline hover:text-foreground"
            onClick={() => setFilter(null)}
          >
            {t("attendance:team.showAll")}
          </button>
        </p>
      )}

      <AttendanceTable
        rows={shown.map((row) => ({
          ...row,
          key: row.userId,
          label: row.name,
        }))}
        timeZone={timeZone}
        firstColumn={t("attendance:table.person")}
        onRowClick={(row) =>
          navigate({
            to: "/dashboard/workspace/$workspaceId/people/$userId",
            params: { workspaceId, userId: row.key },
          })
        }
      />
    </div>
  );
}
