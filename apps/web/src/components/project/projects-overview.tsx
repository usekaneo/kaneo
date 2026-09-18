import { differenceInCalendarDays, startOfToday } from "date-fns";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TableCell } from "@/components/ui/table";
import icons from "@/constants/project-icons";
import type useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { cn } from "@/lib/cn";
import { formatDateShort, formatRelativeTime } from "@/lib/format";
import { formatHours } from "@/lib/format-duration";
import { getInitials } from "@/lib/get-initials";

export type ProjectItem = NonNullable<
  ReturnType<typeof useGetProjects>["data"]
>[number];

export type Health = "empty" | "done" | "atRisk" | "dueSoon" | "onTrack";

/** One word for how a project is doing, from its task counts. */
export function projectHealth(p: ProjectItem): Health {
  const s = p.statistics;
  if (s.totalTasks === 0) return "empty";
  if (s.openTasks === 0) return "done";
  if (s.overdueTasks > 0) return "atRisk";
  if (s.dueThisWeekTasks > 0) return "dueSoon";
  return "onTrack";
}

const HEALTH_STYLE: Record<Health, { pill: string; bar: string }> = {
  empty: { pill: "bg-muted text-muted-foreground", bar: "bg-muted-foreground" },
  done: {
    pill: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    bar: "bg-emerald-500",
  },
  atRisk: {
    pill: "bg-red-500/10 text-red-700 dark:text-red-300",
    bar: "bg-red-500",
  },
  dueSoon: {
    pill: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
    bar: "bg-amber-500",
  },
  onTrack: {
    pill: "bg-sky-500/10 text-sky-700 dark:text-sky-300",
    bar: "bg-sky-500",
  },
};

// A stable tint per project, so each one is recognisable at a glance.
const TINTS = [
  "bg-sky-500/15 text-sky-600 dark:text-sky-300",
  "bg-violet-500/15 text-violet-600 dark:text-violet-300",
  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-600 dark:text-amber-300",
  "bg-rose-500/15 text-rose-600 dark:text-rose-300",
  "bg-teal-500/15 text-teal-600 dark:text-teal-300",
];

function tintFor(id: string) {
  let hash = 0;
  for (const char of id) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export const PROJECT_FILTERS = ["all", "active", "atRisk", "done"] as const;
export type ProjectFilter = (typeof PROJECT_FILTERS)[number];

export function matchesFilter(p: ProjectItem, filter: ProjectFilter) {
  const health = projectHealth(p);
  if (filter === "active") return health !== "done";
  if (filter === "atRisk") return health === "atRisk";
  if (filter === "done") return health === "done";
  return true;
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "danger" | "warning";
}) {
  return (
    <div className="min-w-0 px-4 py-3">
      <div
        className={cn(
          "text-lg font-semibold tabular-nums",
          tone === "danger" && "text-destructive",
          tone === "warning" && "text-amber-600 dark:text-amber-400",
        )}
      >
        {value}
      </div>
      <div className="truncate text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/** The workspace's projects in six numbers. */
export function ProjectsSummary({ projects }: { projects: ProjectItem[] }) {
  const { t } = useTranslation();
  const totals = projects.reduce(
    (sum, p) => ({
      active: sum.active + (projectHealth(p) === "done" ? 0 : 1),
      done: sum.done + (projectHealth(p) === "done" ? 1 : 0),
      open: sum.open + p.statistics.openTasks,
      overdue: sum.overdue + p.statistics.overdueTasks,
      week: sum.week + p.statistics.dueThisWeekTasks,
      tracked: sum.tracked + p.statistics.trackedSecondsLast30Days,
    }),
    { active: 0, done: 0, open: 0, overdue: 0, week: 0, tracked: 0 },
  );
  return (
    <div className="grid grid-cols-2 divide-border rounded-lg border border-border sm:grid-cols-3 sm:divide-x lg:grid-cols-6">
      <Stat
        label={t("workspace:projects.summary.active")}
        value={String(totals.active)}
      />
      <Stat
        label={t("workspace:projects.summary.openTasks")}
        value={String(totals.open)}
      />
      <Stat
        label={t("workspace:projects.summary.overdue")}
        value={String(totals.overdue)}
        tone={totals.overdue > 0 ? "danger" : undefined}
      />
      <Stat
        label={t("workspace:projects.summary.dueThisWeek")}
        value={String(totals.week)}
        tone={totals.week > 0 ? "warning" : undefined}
      />
      <Stat
        label={t("workspace:projects.summary.tracked")}
        value={formatHours(totals.tracked)}
      />
      <Stat
        label={t("workspace:projects.summary.complete")}
        value={String(totals.done)}
      />
    </div>
  );
}

/** Who works on a project, as overlapping faces. */
function Team({ workspaceId, ids }: { workspaceId: string; ids: string[] }) {
  const { data } = useGetActiveWorkspaceUsers(workspaceId);
  const people = useMemo(() => {
    const byId = new Map(
      (data?.members ?? []).map((m) => [m.userId, m.user] as const),
    );
    return ids.flatMap((id) => {
      const user = byId.get(id);
      return user ? [{ id, name: user.name ?? "", image: user.image }] : [];
    });
  }, [data, ids]);

  if (people.length === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  return (
    <div className="flex items-center">
      <div className="flex -space-x-1.5">
        {people.slice(0, 4).map((p) => (
          <Avatar
            key={p.id}
            title={p.name}
            className="size-6 ring-2 ring-background"
          >
            <AvatarImage src={p.image ?? ""} alt={p.name} />
            <AvatarFallback className="bg-muted text-[9px] font-semibold">
              {getInitials(p.name)}
            </AvatarFallback>
          </Avatar>
        ))}
      </div>
      {people.length > 4 && (
        <span className="ms-1.5 text-xs text-muted-foreground">
          +{people.length - 4}
        </span>
      )}
    </div>
  );
}

function NextDue({ date, open }: { date: string | null; open: number }) {
  const { t } = useTranslation();
  if (!date || open === 0) {
    return <span className="text-xs text-muted-foreground">—</span>;
  }
  const days = differenceInCalendarDays(new Date(date), startOfToday());
  const hint =
    days < 0
      ? t("workspace:projects.due.overdue", { count: -days })
      : days === 0
        ? t("workspace:projects.due.today")
        : t("workspace:projects.due.inDays", { count: days });
  return (
    <div className="leading-tight">
      <div className="text-sm tabular-nums">{formatDateShort(date)}</div>
      <div
        className={cn(
          "text-[11px]",
          days < 0
            ? "text-destructive"
            : days <= 7
              ? "text-amber-600 dark:text-amber-400"
              : "text-muted-foreground",
        )}
      >
        {hint}
      </div>
    </div>
  );
}

/** Cells for one project row; the row itself stays sortable in the page. */
export function ProjectRowCells({
  project,
  workspaceId,
}: {
  project: ProjectItem;
  workspaceId: string;
}) {
  const { t } = useTranslation();
  const s = project.statistics;
  const health = projectHealth(project);
  const style = HEALTH_STYLE[health];
  const Icon = icons[project.icon as keyof typeof icons] || icons.Layout;

  return (
    <>
      <TableCell className="py-3 ps-4">
        <div className="flex min-w-0 items-center gap-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-lg",
              tintFor(project.id),
            )}
          >
            <Icon className="size-4.5" />
          </span>
          <div className="min-w-0">
            <div className="truncate font-medium">{project.name}</div>
            <div className="truncate text-xs text-muted-foreground">
              {project.slug} ·{" "}
              {t("workspace:projects.taskCounts", {
                open: s.openTasks,
                done: s.completedTasks,
              })}
            </div>
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <div className="w-36">
          <div className="mb-1 flex items-baseline justify-between text-xs">
            <span className="font-medium tabular-nums">
              {s.completionPercentage}%
            </span>
            <span className="text-muted-foreground tabular-nums">
              {s.completedTasks}/{s.totalTasks}
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full transition-all", style.bar)}
              style={{ width: `${s.completionPercentage}%` }}
            />
          </div>
        </div>
      </TableCell>
      <TableCell className="py-3">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium whitespace-nowrap",
            style.pill,
          )}
        >
          <span className={cn("size-1.5 rounded-full", style.bar)} />
          {health === "atRisk"
            ? t("workspace:projects.health.atRiskCount", {
                count: s.overdueTasks,
              })
            : t(`workspace:projects.health.${health}`)}
        </span>
      </TableCell>
      <TableCell className="py-3">
        <Team workspaceId={workspaceId} ids={s.assigneeIds} />
      </TableCell>
      <TableCell className="py-3">
        <NextDue date={s.nextDueDate} open={s.openTasks} />
      </TableCell>
      <TableCell className="py-3 text-sm tabular-nums">
        {s.trackedSecondsLast30Days > 0 ? (
          formatHours(s.trackedSecondsLast30Days)
        ) : (
          <span className="text-muted-foreground">—</span>
        )}
        {s.estimateMinutes > 0 && (
          <div className="text-[11px] text-muted-foreground">
            {t("workspace:projects.estimated", {
              time: formatHours(s.estimateMinutes * 60),
            })}
          </div>
        )}
      </TableCell>
      <TableCell className="py-3 pe-4 text-xs text-muted-foreground whitespace-nowrap">
        {s.lastActivityAt ? formatRelativeTime(s.lastActivityAt) : "—"}
      </TableCell>
    </>
  );
}
