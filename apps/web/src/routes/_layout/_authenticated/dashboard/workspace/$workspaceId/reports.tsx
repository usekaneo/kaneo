import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Download } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { dayStatusLabel, statusTone } from "@/components/attendance/day-status";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { ActivityFeed } from "@/components/reports/activity-feed";
import {
  DailyBars,
  fillDays,
  InlineBar,
  Legend,
  type Series,
} from "@/components/reports/charts";
import { leaveTypeLabel } from "@/components/requests/labels";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ReportQuery, ReportSummary } from "@/fetchers/reports";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import usePeople from "@/hooks/queries/people/use-people";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useReportSummary } from "@/hooks/queries/use-reports";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import { formatHours } from "@/lib/format-duration";
import { formatMoney } from "@/lib/money";
import { addDaysToDay, zonedDay } from "@/lib/zoned-time";

const TABS = ["overview", "tasks", "time", "people", "activity"] as const;
type Tab = (typeof TABS)[number];
const PRESETS = [
  "thisWeek",
  "thisMonth",
  "lastMonth",
  "last30",
  "thisQuarter",
  "custom",
] as const;
type Preset = (typeof PRESETS)[number];

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/reports",
)({
  validateSearch: (search: Record<string, unknown>): { tab?: Tab } => ({
    tab: TABS.includes(search.tab as Tab) ? (search.tab as Tab) : undefined,
  }),
  component: RouteComponent,
});

const pad = (n: number) => String(n).padStart(2, "0");

/** A preset's [from, to] in the workspace's calendar (weeks start Sunday). */
function presetRange(preset: Preset, today: string) {
  const [y = 1970, m = 1, d = 1] = today.split("-").map(Number);
  const weekday = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  const monthStart = `${y}-${pad(m)}-01`;
  switch (preset) {
    case "thisWeek":
      return { from: addDaysToDay(today, -weekday), to: today };
    case "lastMonth": {
      const first = new Date(Date.UTC(y, m - 2, 1));
      const last = new Date(Date.UTC(y, m - 1, 0));
      return {
        from: first.toISOString().slice(0, 10),
        to: last.toISOString().slice(0, 10),
      };
    }
    case "last30":
      return { from: addDaysToDay(today, -29), to: today };
    case "thisQuarter": {
      const q = Math.floor((m - 1) / 3) * 3 + 1;
      return { from: `${y}-${pad(q)}-01`, to: today };
    }
    default:
      return { from: monthStart, to: today };
  }
}

function presetLabel(t: (key: string) => string, preset: Preset) {
  switch (preset) {
    case "thisWeek":
      return t("reports:range.thisWeek");
    case "lastMonth":
      return t("reports:range.lastMonth");
    case "last30":
      return t("reports:range.last30");
    case "thisQuarter":
      return t("reports:range.thisQuarter");
    case "custom":
      return t("reports:range.custom");
    default:
      return t("reports:range.thisMonth");
  }
}

function Kpi({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  tone?: "danger";
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-muted-foreground text-xs">{label}</p>
      <p
        className={cn(
          "mt-0.5 font-semibold text-2xl tabular-nums",
          tone === "danger" && "text-destructive",
        )}
      >
        {value}
      </p>
      {hint && <p className="text-muted-foreground text-xs">{hint}</p>}
    </div>
  );
}

function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn("space-y-3 rounded-xl border border-border p-4", className)}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-sm">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function csvCell(value: unknown) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(name: string, rows: unknown[][]) {
  const blob = new Blob(
    [rows.map((r) => r.map(csvCell).join(",")).join("\n")],
    {
      type: "text/csv;charset=utf-8",
    },
  );
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function RouteComponent() {
  const { t, i18n } = useTranslation();
  const locale = i18n.language;
  const { workspaceId } = Route.useParams();
  const { tab = "overview" } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const { canReadReports, canSeePeople } = useWorkspacePermission();
  const team = Boolean(canReadReports());
  const { data: company } = useCompanySettings(workspaceId);
  const timeZone = company?.timezone ?? "UTC";
  const today = zonedDay(new Date(), timeZone);

  const [preset, setPreset] = useState<Preset>("thisMonth");
  const [custom, setCustom] = useState(() => presetRange("thisMonth", today));
  const [projectId, setProjectId] = useState<string>("all");
  const [userId, setUserId] = useState<string>("all");
  const range = preset === "custom" ? custom : presetRange(preset, today);

  const { data: projects = [] } = useGetProjects({ workspaceId });
  const { data: people = [] } = usePeople(
    team && canSeePeople() ? workspaceId : undefined,
  );

  const query: ReportQuery | null = company
    ? {
        workspaceId,
        from: range.from,
        to: range.to,
        projectId: projectId === "all" ? undefined : projectId,
        userId: userId === "all" ? undefined : userId,
      }
    : null;
  const { data, isFetching, error } = useReportSummary(query);

  const taskSeries: Series[] = [
    {
      key: "created",
      label: t("reports:tasks.created"),
      color: "var(--viz-series-1)",
    },
    {
      key: "completed",
      label: t("reports:tasks.completed"),
      color: "var(--viz-series-2)",
    },
  ];
  const hourSeries: Series[] = [
    {
      key: "hours",
      label: t("reports:time.hours"),
      color: "var(--viz-series-1)",
    },
  ];

  const taskDays = useMemo(
    () =>
      data
        ? fillDays(range.from, range.to, data.tasks.series, {
            created: 0,
            completed: 0,
          })
        : [],
    [data, range.from, range.to],
  );
  const hourDays = useMemo(
    () =>
      data
        ? fillDays(
            range.from,
            range.to,
            data.time.byDay.map((d) => ({
              day: d.day,
              hours: d.seconds / 3600,
            })),
            { hours: 0 },
          )
        : [],
    [data, range.from, range.to],
  );

  const formatH = (hours: number) => formatHours(Math.round(hours * 3600));
  const attendanceRate = data
    ? (() => {
        const worked =
          data.attendance.totals.presentDays +
          data.attendance.totals.absentDays;
        return worked > 0
          ? Math.round((data.attendance.totals.presentDays / worked) * 100)
          : null;
      })()
    : null;

  const exportCsv = (summary: ReportSummary) => {
    const rows: unknown[][] = [
      [
        t("reports:csv.section"),
        t("reports:csv.name"),
        t("reports:csv.metric"),
        t("reports:csv.value"),
      ],
    ];
    rows.push(["Range", "", "from", range.from], ["Range", "", "to", range.to]);
    for (const [key, value] of Object.entries({
      created: summary.tasks.created,
      completed: summary.tasks.completed,
      open: summary.tasks.open,
      overdue: summary.tasks.overdue,
      trackedHours: (summary.time.trackedSeconds / 3600).toFixed(2),
    })) {
      rows.push(["Totals", "", key, value]);
    }
    for (const p of summary.tasks.byPerson) {
      rows.push(["Tasks by person", p.name ?? "Unassigned", "open", p.open]);
      rows.push([
        "Tasks by person",
        p.name ?? "Unassigned",
        "completed",
        p.completed,
      ]);
      rows.push([
        "Tasks by person",
        p.name ?? "Unassigned",
        "overdue",
        p.overdue,
      ]);
    }
    for (const p of summary.tasks.byProject) {
      rows.push(["Tasks by project", p.name, "created", p.created]);
      rows.push(["Tasks by project", p.name, "completed", p.completed]);
      rows.push(["Tasks by project", p.name, "open", p.open]);
    }
    for (const p of summary.time.byPerson) {
      rows.push([
        "Hours by person",
        p.name ?? "",
        "hours",
        (p.seconds / 3600).toFixed(2),
      ]);
    }
    for (const p of summary.time.byProject) {
      rows.push([
        "Hours by project",
        p.name,
        "hours",
        (p.seconds / 3600).toFixed(2),
      ]);
    }
    for (const p of summary.attendance.people) {
      rows.push(["Attendance", p.name, "present", p.presentDays]);
      rows.push(["Attendance", p.name, "late", p.lateDays]);
      rows.push(["Attendance", p.name, "absent", p.absentDays]);
      rows.push(["Attendance", p.name, "leave", p.leaveDays]);
      rows.push([
        "Attendance",
        p.name,
        "workedHours",
        (p.workedMinutes / 60).toFixed(2),
      ]);
    }
    downloadCsv(`report-${range.from}-${range.to}.csv`, rows);
  };

  const maxOpen = Math.max(
    1,
    ...(data?.tasks.byPerson.map((p) => p.open + p.completed) ?? [0]),
  );
  const maxProject = Math.max(
    1,
    ...(data?.tasks.byProject.map((p) => p.open + p.completed) ?? [0]),
  );
  const maxPersonHours = Math.max(
    1,
    ...(data?.time.byPerson.map((p) => p.seconds) ?? [0]),
  );
  const maxProjectHours = Math.max(
    1,
    ...(data?.time.byProject.map((p) => p.seconds) ?? [0]),
  );

  const personTasks = data && (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="ps-4">{t("reports:columns.person")}</TableHead>
          <TableHead className="w-56">{t("reports:tasks.completed")}</TableHead>
          <TableHead className="text-right">
            {t("reports:tasks.open")}
          </TableHead>
          <TableHead className="pe-4 text-right">
            {t("reports:tasks.overdue")}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {data.tasks.byPerson.map((p) => (
          <TableRow key={p.userId ?? "none"}>
            <TableCell className="ps-4 font-medium">
              {p.name ?? t("reports:unassigned")}
            </TableCell>
            <TableCell>
              <InlineBar
                value={p.completed}
                max={maxOpen}
                label={String(p.completed)}
              />
            </TableCell>
            <TableCell className="text-right tabular-nums">{p.open}</TableCell>
            <TableCell
              className={cn(
                "pe-4 text-right tabular-nums",
                p.overdue > 0 && "font-medium text-destructive",
              )}
            >
              {p.overdue}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <>
      <PageTitle title={t("reports:title")} />
      <WorkspaceLayout
        title={t("reports:title")}
        headerActions={
          data ? (
            <Button
              size="xs"
              variant="outline"
              className="gap-1"
              onClick={() => exportCsv(data)}
            >
              <Download className="size-3" />
              {t("reports:export")}
            </Button>
          ) : null
        }
      >
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((value) => (
                <Button
                  key={value}
                  size="xs"
                  variant={preset === value ? "default" : "outline"}
                  onClick={() => {
                    if (value === "custom") setCustom(range);
                    setPreset(value);
                  }}
                >
                  {presetLabel(t, value)}
                </Button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="flex items-center gap-1">
                <Input
                  type="date"
                  value={custom.from}
                  max={custom.to}
                  aria-label={t("reports:range.from")}
                  className="h-7 w-36 text-xs"
                  onChange={(e) =>
                    e.target.value &&
                    setCustom((c) => ({ ...c, from: e.target.value }))
                  }
                />
                <span className="text-muted-foreground">–</span>
                <Input
                  type="date"
                  value={custom.to}
                  min={custom.from}
                  aria-label={t("reports:range.to")}
                  className="h-7 w-36 text-xs"
                  onChange={(e) =>
                    e.target.value &&
                    setCustom((c) => ({ ...c, to: e.target.value }))
                  }
                />
              </div>
            )}
            <div className="ms-auto flex flex-wrap gap-2">
              <Select
                value={projectId}
                onValueChange={(v) => setProjectId(String(v))}
              >
                <SelectTrigger size="sm" className="w-44">
                  <SelectValue>
                    {projectId === "all"
                      ? t("reports:filters.allProjects")
                      : (projects.find((p) => p.id === projectId)?.name ??
                        t("reports:filters.allProjects"))}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {t("reports:filters.allProjects")}
                  </SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {team && people.length > 0 && (
                <Select
                  value={userId}
                  onValueChange={(v) => setUserId(String(v))}
                >
                  <SelectTrigger size="sm" className="w-44">
                    <SelectValue>
                      {userId === "all"
                        ? t("reports:filters.everyone")
                        : (people.find((p) => p.userId === userId)?.name ??
                          t("reports:filters.everyone"))}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      {t("reports:filters.everyone")}
                    </SelectItem>
                    {people.map((p) => (
                      <SelectItem key={p.userId} value={p.userId}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <p className="text-muted-foreground text-xs">
            {formatDateMedium(`${range.from}T12:00:00Z`)} –{" "}
            {formatDateMedium(`${range.to}T12:00:00Z`)} ·{" "}
            {timeZone.replace(/_/g, " ")}
            {!team && ` · ${t("reports:onlyYou")}`}
            {isFetching && ` · ${t("reports:loading")}`}
          </p>

          {error && (
            <p className="rounded-lg border border-destructive/40 bg-destructive/8 px-3 py-2 text-destructive text-sm">
              {error.message}
            </p>
          )}

          {data && (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
              <Kpi
                label={t("reports:tasks.created")}
                value={data.tasks.created}
              />
              <Kpi
                label={t("reports:tasks.completed")}
                value={data.tasks.completed}
                hint={
                  data.tasks.averageCycleHours !== null
                    ? t("reports:tasks.cycle", {
                        time: formatH(data.tasks.averageCycleHours),
                      })
                    : null
                }
              />
              <Kpi label={t("reports:tasks.open")} value={data.tasks.open} />
              <Kpi
                label={t("reports:tasks.overdue")}
                value={data.tasks.overdue}
                tone={data.tasks.overdue > 0 ? "danger" : undefined}
              />
              <Kpi
                label={t("reports:time.tracked")}
                value={formatHours(data.time.trackedSeconds)}
              />
              <Kpi
                label={t("reports:attendance.rate")}
                value={attendanceRate === null ? "–" : `${attendanceRate}%`}
                hint={t("reports:attendance.lateDays", {
                  count: data.attendance.totals.lateDays,
                })}
              />
            </div>
          )}

          <Tabs
            value={tab}
            onValueChange={(value) =>
              navigate({
                search: value === "overview" ? {} : { tab: value as Tab },
              })
            }
          >
            <TabsList>
              <TabsTrigger value="overview">
                {t("reports:tabs.overview")}
              </TabsTrigger>
              <TabsTrigger value="tasks">{t("reports:tabs.tasks")}</TabsTrigger>
              <TabsTrigger value="time">{t("reports:tabs.time")}</TabsTrigger>
              <TabsTrigger value="people">
                {t("reports:tabs.people")}
              </TabsTrigger>
              <TabsTrigger value="activity">
                {t("reports:tabs.activity")}
              </TabsTrigger>
            </TabsList>

            {data && (
              <>
                <TabsContent value="overview" className="space-y-4 pt-4">
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Panel
                      title={t("reports:tasks.flowTitle")}
                      action={<Legend series={taskSeries} />}
                    >
                      <DailyBars
                        data={taskDays}
                        series={taskSeries}
                        locale={locale}
                      />
                    </Panel>
                    <Panel title={t("reports:time.perDay")}>
                      <DailyBars
                        data={hourDays}
                        series={hourSeries}
                        locale={locale}
                        format={formatH}
                      />
                    </Panel>
                  </div>
                  {team && (
                    <Panel
                      title={t("reports:tasks.byPerson")}
                      className="px-0 pb-0"
                    >
                      <div className="overflow-x-auto">{personTasks}</div>
                    </Panel>
                  )}
                </TabsContent>

                <TabsContent value="tasks" className="space-y-4 pt-4">
                  <Panel
                    title={t("reports:tasks.flowTitle")}
                    action={<Legend series={taskSeries} />}
                  >
                    <DailyBars
                      data={taskDays}
                      series={taskSeries}
                      locale={locale}
                    />
                  </Panel>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Panel
                      title={t("reports:tasks.byPerson")}
                      className="px-0 pb-0"
                    >
                      <div className="overflow-x-auto">{personTasks}</div>
                    </Panel>
                    <Panel
                      title={t("reports:tasks.byProject")}
                      className="px-0 pb-0"
                    >
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="ps-4">
                                {t("reports:columns.project")}
                              </TableHead>
                              <TableHead className="w-56">
                                {t("reports:tasks.completed")}
                              </TableHead>
                              <TableHead className="text-right">
                                {t("reports:tasks.created")}
                              </TableHead>
                              <TableHead className="pe-4 text-right">
                                {t("reports:tasks.open")}
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.tasks.byProject.map((p) => (
                              <TableRow key={p.projectId}>
                                <TableCell className="ps-4 font-medium">
                                  {p.name}
                                </TableCell>
                                <TableCell>
                                  <InlineBar
                                    value={p.completed}
                                    max={maxProject}
                                    label={String(p.completed)}
                                  />
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {p.created}
                                </TableCell>
                                <TableCell className="pe-4 text-right tabular-nums">
                                  {p.open}
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </Panel>
                  </div>
                  <Panel
                    title={t("reports:tasks.overdueList")}
                    className="px-0 pb-0"
                  >
                    {data.tasks.overdueTasks.length === 0 ? (
                      <p className="px-4 pb-4 text-muted-foreground text-sm">
                        {t("reports:tasks.noneOverdue")}
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {data.tasks.overdueTasks.map((task) => (
                          <li
                            key={task.id}
                            className="flex items-center gap-3 px-4 py-2 text-sm"
                          >
                            <Link
                              to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                              params={{
                                workspaceId,
                                projectId: task.projectId,
                                taskId: task.id,
                              }}
                              className="min-w-0 flex-1 truncate font-medium hover:underline"
                            >
                              {task.title}
                            </Link>
                            <span className="hidden text-muted-foreground sm:inline">
                              {task.projectName}
                            </span>
                            <span className="w-32 truncate text-muted-foreground">
                              {task.assigneeName ?? t("reports:unassigned")}
                            </span>
                            <span className="w-28 text-right text-destructive tabular-nums">
                              {formatDateMedium(task.dueDate)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </Panel>
                </TabsContent>

                <TabsContent value="time" className="space-y-4 pt-4">
                  <Panel title={t("reports:time.perDay")}>
                    <DailyBars
                      data={hourDays}
                      series={hourSeries}
                      locale={locale}
                      format={formatH}
                    />
                  </Panel>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Panel title={t("reports:time.byPerson")}>
                      <ul className="space-y-2">
                        {data.time.byPerson.map((p) => (
                          <li
                            key={p.userId ?? "none"}
                            className="grid grid-cols-[10rem_1fr] items-center gap-3 text-sm"
                          >
                            <span className="truncate">{p.name ?? "–"}</span>
                            <InlineBar
                              value={p.seconds}
                              max={maxPersonHours}
                              label={formatHours(p.seconds)}
                            />
                          </li>
                        ))}
                      </ul>
                    </Panel>
                    <Panel title={t("reports:time.byProject")}>
                      <ul className="space-y-2">
                        {data.time.byProject.map((p) => (
                          <li
                            key={p.projectId}
                            className="grid grid-cols-[10rem_1fr] items-center gap-3 text-sm"
                          >
                            <span className="truncate">{p.name}</span>
                            <InlineBar
                              value={p.seconds}
                              max={maxProjectHours}
                              label={formatHours(p.seconds)}
                            />
                          </li>
                        ))}
                      </ul>
                    </Panel>
                  </div>
                </TabsContent>

                <TabsContent value="people" className="space-y-4 pt-4">
                  <Panel
                    title={t("reports:attendance.title")}
                    className="px-0 pb-0"
                  >
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="ps-4">
                              {t("reports:columns.person")}
                            </TableHead>
                            {(
                              ["present", "late", "absent", "leave"] as const
                            ).map((s) => (
                              <TableHead key={s} className="text-right">
                                <span className="inline-flex items-center gap-1.5">
                                  <span
                                    className={cn(
                                      "size-2 rounded-full",
                                      statusTone[s].dot,
                                    )}
                                  />
                                  {dayStatusLabel(t, s)}
                                </span>
                              </TableHead>
                            ))}
                            <TableHead className="text-right">
                              {t("reports:attendance.worked")}
                            </TableHead>
                            <TableHead className="pe-4 text-right">
                              {t("reports:attendance.overtime")}
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {data.attendance.people.map((p) => (
                            <TableRow key={p.userId}>
                              <TableCell className="ps-4 font-medium">
                                {p.name}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {p.presentDays}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {p.lateDays}
                              </TableCell>
                              <TableCell
                                className={cn(
                                  "text-right tabular-nums",
                                  p.absentDays > 0 && "text-destructive",
                                )}
                              >
                                {p.absentDays}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {p.leaveDays}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatHours(p.workedMinutes * 60)}
                              </TableCell>
                              <TableCell className="pe-4 text-right tabular-nums">
                                {formatHours(p.overtimeMinutes * 60)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </Panel>
                  <div className="grid gap-4 xl:grid-cols-2">
                    <Panel title={t("reports:leave.title")}>
                      {data.leave.approvedDaysByType.length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                          {t("reports:leave.none")}
                        </p>
                      ) : (
                        <ul className="space-y-2 text-sm">
                          {data.leave.approvedDaysByType.map((l) => (
                            <li key={l.type} className="flex justify-between">
                              <span>{leaveTypeLabel(t, l.type)}</span>
                              <span className="tabular-nums">
                                {t("reports:leave.days", { count: l.days })}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </Panel>
                    {data.expenses && (
                      <Panel title={t("reports:expenses.title")}>
                        {data.expenses.byCategory.length === 0 ? (
                          <p className="text-muted-foreground text-sm">
                            {t("reports:expenses.none")}
                          </p>
                        ) : (
                          <ul className="space-y-2 text-sm">
                            {data.expenses.byCategory.map((e) => (
                              <li
                                key={e.category}
                                className="flex justify-between"
                              >
                                <span>{e.category}</span>
                                <span className="tabular-nums">
                                  {formatMoney(
                                    e.amount,
                                    data.expenses?.currency ?? "USD",
                                    locale,
                                  )}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </Panel>
                    )}
                  </div>
                </TabsContent>
              </>
            )}

            <TabsContent value="activity" className="pt-4">
              {query && (
                <ActivityFeed
                  query={query}
                  locale={locale}
                  timeZone={timeZone}
                />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </WorkspaceLayout>
    </>
  );
}
