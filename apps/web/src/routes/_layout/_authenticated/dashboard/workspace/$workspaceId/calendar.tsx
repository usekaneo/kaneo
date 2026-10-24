import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  addMonths,
  endOfDay,
  startOfDay,
  startOfMonth,
  subMonths,
} from "date-fns";
import { CalendarDays } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import CalendarToolbar from "@/components/calendar/calendar-toolbar";
import type { CalendarTask } from "@/components/calendar/calendar-task-bar";
import MonthAgenda from "@/components/calendar/month-agenda";
import MonthGrid from "@/components/calendar/month-grid";
import { buildMonthWeeks } from "@/components/calendar/month-grid-model";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { WeekStartControl } from "@/components/project/display/week-start-control";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { Toggle } from "@/components/ui/toggle";
import useGetScheduledTasks from "@/hooks/queries/task/use-get-scheduled-tasks";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useIsMobile } from "@/hooks/use-mobile";
import { toScheduledTask } from "@/lib/task-schedule";
import { useUserPreferencesStore } from "@/store/user-preferences";

type CalendarSearchParams = {
  taskId?: string;
  projectId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/calendar",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
    projectId:
      typeof search.projectId === "string" ? search.projectId : undefined,
  }),
});

const MAX_LANES_DESKTOP = 3;

type WorkspaceCalendarTask = CalendarTask & {
  projectId: string;
  projectSlug: string;
};

function RouteComponent() {
  const { t } = useTranslation();
  const { workspaceId } = Route.useParams();
  const { taskId, projectId: searchProjectId } = Route.useSearch();
  const navigate = useNavigate();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const isMobile = useIsMobile();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [assignedToMeOnly, setAssignedToMeOnly] = useState(false);

  // Match the week-padded grid so leading/trailing days are not empty holes.
  const weeks = useMemo(
    () => buildMonthWeeks(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn],
  );

  const visibleRange = useMemo(() => {
    const firstDay = weeks[0]?.[0];
    const lastWeek = weeks[weeks.length - 1];
    const lastDay = lastWeek?.[lastWeek.length - 1];
    if (!firstDay || !lastDay) {
      return null;
    }
    return {
      from: startOfDay(firstDay).toISOString(),
      to: endOfDay(lastDay).toISOString(),
    };
  }, [weeks]);

  const {
    data: scheduled,
    isLoading,
    isError,
  } = useGetScheduledTasks(workspaceId, {
    from: visibleRange?.from ?? "",
    to: visibleRange?.to ?? "",
    assignedToMe: assignedToMeOnly,
  });

  const scheduledTasks = useMemo(() => {
    const tasks: WorkspaceCalendarTask[] = [];
    for (const task of scheduled?.tasks ?? []) {
      const mapped = toScheduledTask(task);
      if (!mapped) continue;
      tasks.push({
        id: mapped.id,
        title: mapped.title,
        number: mapped.number,
        status: mapped.status,
        scheduleStart: mapped.scheduleStart,
        scheduleEnd: mapped.scheduleEnd,
        projectId: mapped.projectId,
        projectSlug: mapped.projectSlug,
      });
    }
    return tasks;
  }, [scheduled?.tasks]);

  const selectedTask = useMemo(
    () => scheduledTasks.find((task) => task.id === taskId) ?? null,
    [scheduledTasks, taskId],
  );

  const needsTaskLookup = Boolean(taskId) && !selectedTask && !searchProjectId;
  const { data: lookedUpTask } = useGetTask(
    needsTaskLookup ? (taskId ?? "") : "",
  );

  const sheetProjectIdRef = useRef(
    selectedTask?.projectId ?? searchProjectId ?? "",
  );
  const resolvedProjectId =
    selectedTask?.projectId ??
    searchProjectId ??
    lookedUpTask?.projectId ??
    sheetProjectIdRef.current;
  if (resolvedProjectId) {
    sheetProjectIdRef.current = resolvedProjectId;
  }

  const handlePreviousMonth = useCallback(() => {
    setVisibleMonth((current) => subMonths(current, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setVisibleMonth((current) => addMonths(current, 1));
  }, []);

  const handleToday = useCallback(() => {
    setVisibleMonth(startOfMonth(new Date()));
  }, []);

  const handleOpenTask = useCallback(
    (nextTaskId: string) => {
      const task = scheduledTasks.find((entry) => entry.id === nextTaskId);
      navigate({
        to: ".",
        search: {
          taskId: nextTaskId,
          ...(task?.projectId ? { projectId: task.projectId } : {}),
        },
        replace: true,
      });
    },
    [navigate, scheduledTasks],
  );

  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  const emptyTitle = assignedToMeOnly
    ? t("workspace:calendar.noAssignedTasksThisMonth")
    : t("workspace:calendar.noTasksThisMonth");
  const emptySubtitle = assignedToMeOnly
    ? t("workspace:calendar.noAssignedTasksThisMonthSubtitle")
    : t("workspace:calendar.noTasksThisMonthSubtitle");

  return (
    <>
      <PageTitle title={t("workspace:calendar.pageTitle")} />
      <WorkspaceLayout
        title={t("workspace:calendar.pageTitle")}
        headerActions={<WeekStartControl />}
      >
        <div className="flex h-full min-h-0 flex-col bg-background">
          <CalendarToolbar
            visibleMonth={visibleMonth}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            filters={
              <Toggle
                variant="outline"
                size="sm"
                pressed={assignedToMeOnly}
                onPressedChange={setAssignedToMeOnly}
                aria-label={
                  assignedToMeOnly
                    ? t("workspace:calendar.assignedToMe")
                    : t("workspace:calendar.allTasks")
                }
                className="min-h-11 touch-manipulation px-2.5 sm:min-h-0"
              >
                {assignedToMeOnly
                  ? t("workspace:calendar.assignedToMe")
                  : t("workspace:calendar.allTasks")}
              </Toggle>
            }
          />

          {isLoading ? (
            <div className="flex flex-col gap-2 p-4">
              {[1, 2, 3, 4, 5].map((row) => (
                <Skeleton key={row} className="h-11 w-full" />
              ))}
            </div>
          ) : isError && !scheduled ? (
            <p role="alert" className="p-6 text-muted-foreground text-sm">
              {t("workspace:calendar.loadError")}
            </p>
          ) : scheduledTasks.length === 0 ? (
            <Empty className="min-h-[60vh]">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CalendarDays />
                </EmptyMedia>
                <EmptyTitle>{emptyTitle}</EmptyTitle>
                <EmptyDescription>{emptySubtitle}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : isMobile ? (
            <MonthAgenda
              tasks={scheduledTasks}
              visibleMonth={visibleMonth}
              onOpenTask={handleOpenTask}
            />
          ) : (
            <MonthGrid
              weeks={weeks}
              tasks={scheduledTasks}
              visibleMonth={visibleMonth}
              maxLanes={MAX_LANES_DESKTOP}
              onOpenTask={handleOpenTask}
            />
          )}

          {scheduled && scheduled.total > scheduled.tasks.length ? (
            <p className="border-t border-border/80 px-4 py-2 text-xs text-muted-foreground">
              {t("workspace:calendar.truncated", {
                shown: scheduled.tasks.length,
                total: scheduled.total,
              })}
            </p>
          ) : null}

          <TaskDetailsSheet
            taskId={resolvedProjectId ? taskId : undefined}
            projectId={resolvedProjectId}
            workspaceId={workspaceId}
            onClose={handleCloseTaskSheet}
          />
        </div>
      </WorkspaceLayout>
    </>
  );
}
