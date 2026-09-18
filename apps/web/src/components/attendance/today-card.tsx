import { LogIn, LogOut, Palmtree } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  useClockIn,
  useClockOut,
} from "@/hooks/mutations/attendance/use-attendance-mutations";
import { useAttendanceStatus } from "@/hooks/queries/attendance/use-attendance";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import { useNow } from "@/hooks/use-now";
import { cn } from "@/lib/cn";
import { formatHours } from "@/lib/format-duration";
import { toast } from "@/lib/toast";
import { zonedClock } from "@/lib/zoned-time";
import { leaveTypeLabel } from "../requests/labels";
import { DayStatusBadge } from "./day-status";

/** "GMT+6" for Asia/Dhaka: what people recognise, next to the zone name. */
export function zoneOffsetLabel(timeZone: string, at = new Date()) {
  try {
    return (
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        timeZoneName: "shortOffset",
      })
        .formatToParts(at)
        .find((p) => p.type === "timeZoneName")?.value ?? ""
    );
  } catch {
    return "";
  }
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground text-xs">{label}</div>
      <div className="font-semibold text-lg tabular-nums">{value}</div>
      {hint && <div className="text-muted-foreground text-xs">{hint}</div>}
    </div>
  );
}

// The first thing people see: the company's clock, where they stand today,
// and one big button.
export function TodayCard({ workspaceId }: { workspaceId: string }) {
  const { t, i18n } = useTranslation();
  const { data: status, dataUpdatedAt } = useAttendanceStatus(workspaceId);
  const { data: company } = useCompanySettings(workspaceId);
  const clockIn = useClockIn(workspaceId);
  const clockOut = useClockOut(workspaceId);
  const now = useNow(true);
  const timeZone = company?.timezone ?? "UTC";

  const fail = (error: unknown) =>
    toast.error(
      error instanceof Error ? error.message : t("attendance:card.error"),
    );

  const today = status?.today;
  const workedSeconds =
    (today?.workedMinutes ?? 0) * 60 +
    (status?.clockedIn
      ? Math.max(0, Math.floor((now.getTime() - dataUpdatedAt) / 1000))
      : 0);
  const targetSeconds = Math.max(
    0,
    ((today?.scheduledMinutes ?? 0) - (company?.breakMinutes ?? 0)) * 60,
  );
  const progress =
    targetSeconds > 0 ? Math.min(1, workedSeconds / targetSeconds) : 0;
  const onLeave = today?.status === "leave";
  // A clock-in undone within the same minute is noise, not a session.
  const sessions = (today?.sessions ?? []).filter(
    (s) =>
      !s.clockOut ||
      new Date(s.clockOut).getTime() - new Date(s.clockIn).getTime() >= 60_000,
  );

  const clock = new Intl.DateTimeFormat(i18n.language, {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(now);
  const date = new Intl.DateTimeFormat(i18n.language, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(now);

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-gradient-to-br from-primary/[0.06] via-background to-background">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="space-y-1">
          <p className="text-muted-foreground text-sm">{date}</p>
          <p className="font-semibold text-4xl tabular-nums tracking-tight">
            {clock}
          </p>
          <p className="text-muted-foreground text-xs">
            {timeZone.replace(/_/g, " ")} · {zoneOffsetLabel(timeZone, now)}
            {company &&
              ` · ${t("attendance:today.officeHours", {
                start: company.workStart,
                end: company.workEnd,
              })}`}
          </p>
        </div>

        <div className="flex flex-col items-end gap-2">
          {today && <DayStatusBadge day={today} />}
          {onLeave ? (
            <div className="flex items-center gap-2 rounded-lg bg-sky-500/10 px-3 py-2 text-sky-700 text-sm dark:text-sky-300">
              <Palmtree className="size-4" />
              {t("attendance:today.onLeave", {
                type: leaveTypeLabel(t, today?.leaveType ?? "annual"),
              })}
            </div>
          ) : status?.clockedIn ? (
            <Button
              size="lg"
              variant="outline"
              className="min-w-40 gap-2 border-rose-500/40 text-rose-600 hover:bg-rose-500/10 dark:text-rose-400"
              disabled={clockOut.isPending}
              onClick={() => clockOut.mutateAsync().catch(fail)}
            >
              <LogOut className="size-4" />
              {t("attendance:card.clockOut")}
            </Button>
          ) : (
            <Button
              size="lg"
              className="min-w-40 gap-2 bg-emerald-600 text-white hover:bg-emerald-600/90"
              disabled={clockIn.isPending || !status}
              onClick={() => clockIn.mutateAsync().catch(fail)}
            >
              <LogIn className="size-4" />
              {t("attendance:card.clockIn")}
            </Button>
          )}
        </div>
      </div>

      <div className="space-y-3 border-border border-t bg-background/60 p-5">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Stat
            label={t("attendance:today.firstIn")}
            value={today?.firstIn ? zonedClock(today.firstIn, timeZone) : "–"}
            hint={
              today?.status === "late"
                ? t("attendance:status.lateBy", {
                    minutes: today.lateMinutes,
                  })
                : null
            }
          />
          <Stat
            label={t("attendance:today.lastOut")}
            value={
              status?.clockedIn ? (
                <span className="text-emerald-600 dark:text-emerald-400">
                  {t("attendance:table.now")}
                </span>
              ) : today?.lastOut ? (
                zonedClock(today.lastOut, timeZone)
              ) : (
                "–"
              )
            }
          />
          <Stat
            label={t("attendance:today.worked")}
            value={formatHours(workedSeconds)}
            hint={
              targetSeconds > 0
                ? t("attendance:today.ofTarget", {
                    target: formatHours(targetSeconds),
                  })
                : null
            }
          />
          <Stat
            label={t("attendance:table.overtime")}
            value={formatHours((today?.overtimeMinutes ?? 0) * 60)}
          />
        </div>

        {targetSeconds > 0 && (
          <div
            className="h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-label={t("attendance:today.worked")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div
              className={cn(
                "h-full rounded-full transition-[width] duration-700",
                progress >= 1 ? "bg-emerald-500" : "bg-primary",
              )}
              style={{ width: `${progress * 100}%` }}
            />
          </div>
        )}

        {sessions.length > 0 && (
          <ul className="flex flex-wrap gap-1.5">
            {sessions.map((session) => (
              <li
                key={session.id}
                className="rounded-md border border-border bg-background px-2 py-0.5 text-muted-foreground text-xs tabular-nums"
              >
                {zonedClock(session.clockIn, timeZone)} →{" "}
                {session.clockOut
                  ? zonedClock(session.clockOut, timeZone)
                  : t("attendance:table.now")}
                {session.source === "agent" && (
                  <span
                    className="ms-1.5 rounded bg-primary/10 px-1 font-medium text-[10px] text-primary"
                    title={t("attendance:card.autoHint")}
                  >
                    {t("attendance:card.auto")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
