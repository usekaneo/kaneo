import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import type { AttendanceDay } from "@/fetchers/attendance";
import { cn } from "@/lib/cn";

export type DayStatus = AttendanceDay["status"];

export function dayStatusLabel(t: TFunction, status: DayStatus) {
  switch (status) {
    case "present":
      return t("attendance:status.present");
    case "late":
      return t("attendance:status.late");
    case "absent":
      return t("attendance:status.absent");
    case "leave":
      return t("attendance:status.leave");
    case "off":
      return t("attendance:status.off");
    case "pending":
      return t("attendance:status.pending");
    case "notJoined":
      return t("attendance:status.notJoined");
    default:
      return t("attendance:status.upcoming");
  }
}

/** One color per status, used by badges, calendar cells and legends. */
export const statusTone: Record<
  DayStatus,
  {
    dot: string;
    cell: string;
    badge: "success" | "warning" | "error" | "info" | "outline" | "secondary";
  }
> = {
  present: {
    dot: "bg-emerald-500",
    cell: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
    badge: "success",
  },
  late: {
    dot: "bg-amber-500",
    cell: "bg-amber-500/14 text-amber-700 dark:text-amber-300 border-amber-500/30",
    badge: "warning",
  },
  absent: {
    dot: "bg-rose-500",
    cell: "bg-rose-500/12 text-rose-700 dark:text-rose-300 border-rose-500/30",
    badge: "error",
  },
  leave: {
    dot: "bg-sky-500",
    cell: "bg-sky-500/12 text-sky-700 dark:text-sky-300 border-sky-500/30",
    badge: "info",
  },
  off: {
    dot: "bg-muted-foreground/30",
    cell: "bg-muted/40 text-muted-foreground border-transparent",
    badge: "secondary",
  },
  pending: {
    dot: "bg-muted-foreground/60",
    cell: "border-dashed border-border text-foreground",
    badge: "outline",
  },
  notJoined: {
    dot: "bg-muted-foreground/20",
    cell: "border-transparent bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,var(--color-muted)_6px,var(--color-muted)_7px)] text-muted-foreground/60",
    badge: "outline",
  },
  upcoming: {
    dot: "bg-muted-foreground/20",
    cell: "border-transparent text-muted-foreground/60",
    badge: "outline",
  },
};

export function DayStatusBadge({
  day,
  className,
}: {
  day: Pick<AttendanceDay, "status" | "lateMinutes" | "leaveType">;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <Badge
      variant={statusTone[day.status].badge}
      className={cn("gap-1.5", className)}
    >
      <span
        className={cn("size-1.5 rounded-full", statusTone[day.status].dot)}
        aria-hidden="true"
      />
      {dayStatusLabel(t, day.status)}
      {day.status === "late" && day.lateMinutes > 0 && (
        <span className="tabular-nums opacity-80">
          {t("attendance:status.lateBy", { minutes: day.lateMinutes })}
        </span>
      )}
    </Badge>
  );
}

export function StatusLegend({ statuses }: { statuses: DayStatus[] }) {
  const { t } = useTranslation();
  return (
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-muted-foreground text-xs">
      {statuses.map((status) => (
        <li key={status} className="flex items-center gap-1.5">
          <span
            className={cn("size-2 rounded-full", statusTone[status].dot)}
            aria-hidden="true"
          />
          {dayStatusLabel(t, status)}
        </li>
      ))}
    </ul>
  );
}
