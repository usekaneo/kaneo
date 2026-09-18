import { addDays, format, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Clock, Download } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
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
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import useListTimeEntries from "@/hooks/queries/time-entry/use-list-time-entries";
import useGetFullWorkspace from "@/hooks/queries/workspace/use-get-full-workspace";
import { useNow } from "@/hooks/use-now";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatHours } from "@/lib/format-duration";
import {
  buildTimesheet,
  entrySeconds,
  timesheetCsv,
  weekDays,
  weekStart,
} from "@/lib/timesheet";

const EVERYONE = "__everyone__";

function Hours({ seconds }: { seconds: number }) {
  return seconds > 0 ? (
    <span className="tabular-nums">{formatHours(seconds)}</span>
  ) : (
    <span className="text-muted-foreground/50">–</span>
  );
}

type Props = {
  workspaceId: string;
  // Fixes the view to one person (their page); otherwise the viewer picks.
  userId?: string;
};

export function TimesheetView({ workspaceId, userId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: workspace } = useGetFullWorkspace({ workspaceId });
  const { canSeeEveryonesTime } = useWorkspacePermission();
  const seeEveryone = Boolean(canSeeEveryonesTime());

  const [start, setStart] = useState(() => weekStart(new Date()));
  const [person, setPerson] = useState<string | null>(null);
  // Admins land on the whole team, everyone else on their own week.
  const selected =
    userId ?? person ?? (seeEveryone ? EVERYONE : (user?.id ?? ""));

  const days = useMemo(() => weekDays(start), [start]);
  const query = useMemo(
    () => ({
      workspaceId,
      from: start.toISOString(),
      to: addDays(start, 7).toISOString(),
      ...(selected && selected !== EVERYONE ? { userId: selected } : {}),
    }),
    [workspaceId, start, selected],
  );
  const { data: entries = [], isLoading } = useListTimeEntries(query);

  const hasRunning = entries.some((e) => !e.endTime);
  const now = useNow(hasRunning, 30_000);
  const sheet = useMemo(
    () => buildTimesheet(entries, days, now),
    [entries, days, now],
  );

  const people = useMemo(() => {
    if (selected !== EVERYONE) return [];
    const byPerson = new Map<
      string,
      { name: string; perDay: number[]; total: number }
    >();
    for (const entry of entries) {
      const key = entry.userId ?? "former";
      const dayIndex = days.findIndex((d) =>
        isSameDay(d, new Date(entry.startTime)),
      );
      if (dayIndex === -1) continue;
      const row = byPerson.get(key) ?? {
        name: entry.userName ?? t("time:task.formerMember"),
        perDay: days.map(() => 0),
        total: 0,
      };
      const seconds = entrySeconds(entry, now);
      row.perDay[dayIndex] += seconds;
      row.total += seconds;
      byPerson.set(key, row);
    }
    return [...byPerson.entries()]
      .map(([id, row]) => ({ id, ...row }))
      .sort((a, b) => b.total - a.total);
  }, [selected, entries, days, now, t]);

  const isThisWeek = isSameDay(start, weekStart(new Date()));
  const members = workspace?.members ?? [];
  const personLabel =
    selected === EVERYONE
      ? t("time:sheet.everyone")
      : (members.find((m) => m.userId === selected)?.user.name ?? "");

  const exportCsv = () => {
    const csv = timesheetCsv(
      entries,
      [
        t("time:csv.date"),
        t("time:csv.start"),
        t("time:csv.end"),
        t("time:csv.hours"),
        t("time:csv.person"),
        t("time:csv.project"),
        t("time:csv.task"),
        t("time:csv.note"),
      ],
      new Date(),
    );
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = `timesheet-${format(start, "yyyy-MM-dd")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const dayHeaders = days.map((day) => (
    <TableHead
      key={day.toISOString()}
      className={cn(
        "w-20 text-right font-medium",
        isSameDay(day, new Date())
          ? "text-foreground"
          : "text-muted-foreground",
      )}
    >
      <div>{format(day, "EEE")}</div>
      <div className="text-[11px] font-normal">{format(day, "MMM d")}</div>
    </TableHead>
  ));

  return (
    <div className="space-y-6 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {t("time:sheet.range", {
            from: format(days[0], "MMM d"),
            to: format(days[6], "MMM d, yyyy"),
          })}
          {" · "}
          <span className="font-medium text-foreground tabular-nums">
            {formatHours(sheet.total)}
          </span>
        </p>
        <div className="flex items-center gap-1.5">
          {seeEveryone && !userId && (
            <Select
              value={selected}
              onValueChange={(value) => {
                if (typeof value === "string") setPerson(value);
              }}
            >
              <SelectTrigger size="sm" className="h-7 w-40">
                <SelectValue>{personLabel}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={EVERYONE}>
                  {t("time:sheet.everyone")}
                </SelectItem>
                {members.map((member) => (
                  <SelectItem key={member.userId} value={member.userId}>
                    {member.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <div className="flex items-center">
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("time:sheet.previousWeek")}
              onClick={() => setStart((s) => addDays(s, -7))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              disabled={isThisWeek}
              onClick={() => setStart(weekStart(new Date()))}
            >
              {t("time:sheet.thisWeek")}
            </Button>
            <Button
              variant="ghost"
              size="icon-xs"
              aria-label={t("time:sheet.nextWeek")}
              onClick={() => setStart((s) => addDays(s, 7))}
            >
              <ChevronRight />
            </Button>
          </div>
          <Button
            variant="outline"
            size="xs"
            className="gap-1"
            disabled={entries.length === 0}
            onClick={exportCsv}
          >
            <Download className="size-3" />
            {t("time:sheet.exportCsv")}
          </Button>
        </div>
      </div>

      {!isLoading && entries.length === 0 ? (
        <Empty>
          <EmptyHeader>
            <EmptyMedia>
              <Clock className="size-8 text-muted-foreground" />
            </EmptyMedia>
            <EmptyTitle>{t("time:sheet.emptyTitle")}</EmptyTitle>
            <EmptyDescription>
              {t("time:sheet.emptyDescription")}
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <>
          {people.length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="ps-4 font-medium text-foreground">
                      {t("time:sheet.byPerson")}
                    </TableHead>
                    {dayHeaders}
                    <TableHead className="w-20 pe-4 text-right font-medium text-foreground">
                      {t("time:sheet.total")}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {people.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="ps-4">{row.name}</TableCell>
                      {row.perDay.map((seconds, i) => (
                        <TableCell
                          key={days[i].toISOString()}
                          className="text-right"
                        >
                          <Hours seconds={seconds} />
                        </TableCell>
                      ))}
                      <TableCell className="pe-4 text-right font-medium">
                        <Hours seconds={row.total} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="ps-4 font-medium text-foreground">
                    {t("time:sheet.byTask")}
                  </TableHead>
                  {dayHeaders}
                  <TableHead className="w-20 pe-4 text-right font-medium text-foreground">
                    {t("time:sheet.total")}
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sheet.projects.map((project) => [
                  <TableRow
                    key={project.projectId}
                    className="bg-muted/40 hover:bg-muted/40"
                  >
                    <TableCell className="ps-4 font-medium">
                      {project.projectName}
                    </TableCell>
                    {project.perDay.map((seconds, i) => (
                      <TableCell
                        key={days[i].toISOString()}
                        className="text-right font-medium"
                      >
                        <Hours seconds={seconds} />
                      </TableCell>
                    ))}
                    <TableCell className="pe-4 text-right font-medium">
                      <Hours seconds={project.total} />
                    </TableCell>
                  </TableRow>,
                  ...project.rows.map((row) => (
                    <TableRow key={`${project.projectId}:${row.taskId}`}>
                      <TableCell className="ps-8">
                        <span className="me-2 text-xs text-muted-foreground">
                          {row.taskKey}
                        </span>
                        {row.taskTitle}
                      </TableCell>
                      {row.perDay.map((seconds, i) => (
                        <TableCell
                          key={days[i].toISOString()}
                          className="text-right"
                        >
                          <Hours seconds={seconds} />
                        </TableCell>
                      ))}
                      <TableCell className="pe-4 text-right">
                        <Hours seconds={row.total} />
                      </TableCell>
                    </TableRow>
                  )),
                ])}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="ps-4 font-medium">
                    {t("time:sheet.total")}
                  </TableCell>
                  {sheet.perDay.map((seconds, i) => (
                    <TableCell
                      key={days[i].toISOString()}
                      className="text-right font-medium"
                    >
                      <Hours seconds={seconds} />
                    </TableCell>
                  ))}
                  <TableCell className="pe-4 text-right font-semibold">
                    <Hours seconds={sheet.total} />
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </>
      )}
    </div>
  );
}
