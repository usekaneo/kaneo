import { createFileRoute } from "@tanstack/react-router";
import { addMonths, startOfMonth, subMonths } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import CalendarToolbar from "@/components/calendar/calendar-toolbar";
import MonthGrid from "@/components/calendar/month-grid";
import { buildMonthWeeks } from "@/components/calendar/month-grid-model";
import MyTasksLayout from "@/components/my-tasks/my-tasks-layout";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { TaskViewProvider } from "@/components/task/task-view-context";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMyTasksView } from "@/hooks/use-my-tasks-view";
import { WorkspacePermissionScope } from "@/hooks/use-workspace-permission";
import { toScheduledTasks } from "@/lib/task-schedule";
import { useUserPreferencesStore } from "@/store/user-preferences";

type MyTasksCalendarSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/my-tasks/calendar",
)({
  component: RouteComponent,
  validateSearch: (
    search: Record<string, unknown>,
  ): MyTasksCalendarSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

const MAX_LANES_DESKTOP = 3;
const MAX_LANES_MOBILE = 2;

function RouteComponent() {
  const { t } = useTranslation();
  const { taskId } = Route.useSearch();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const isMobile = useIsMobile();
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const {
    board,
    tasks,
    getProjectSlug,
    taskView,
    totalTasks,
    isLoading,
    isError,
    sheet,
    openTask,
  } = useMyTasksView(taskId);

  const scheduledTasks = useMemo(
    () =>
      toScheduledTasks(board).map((task) => ({
        ...task,
        projectSlug: getProjectSlug(task),
      })),
    [board, getProjectSlug],
  );

  const weeks = useMemo(
    () => buildMonthWeeks(visibleMonth, weekStartsOn),
    [visibleMonth, weekStartsOn],
  );

  const handlePreviousMonth = useCallback(() => {
    setVisibleMonth((current) => subMonths(current, 1));
  }, []);

  const handleNextMonth = useCallback(() => {
    setVisibleMonth((current) => addMonths(current, 1));
  }, []);

  const handleToday = useCallback(() => {
    setVisibleMonth(startOfMonth(new Date()));
  }, []);

  return (
    <MyTasksLayout activeView="calendar">
      {board && (
        <PageTitle
          title={t("tasks:myTasks.pageTitle", {
            view: t("tasks:calendar.title"),
          })}
          hideAppName
        />
      )}
      <TaskViewProvider value={taskView}>
        <div className="flex h-full min-h-0 flex-col bg-background">
          <CalendarToolbar
            visibleMonth={visibleMonth}
            onPreviousMonth={handlePreviousMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
          />

          {isLoading ? (
            <CalendarNotice title={t("common:empty.loading")} tone="muted" />
          ) : isError ? (
            <CalendarNotice
              title={t("tasks:myTasks.loadError")}
              tone="destructive"
            />
          ) : scheduledTasks.length === 0 ? (
            <CalendarNotice
              title={t("tasks:calendar.noTasks")}
              subtitle={t("tasks:calendar.noTasksSubtitle")}
            />
          ) : totalTasks > tasks.length ? (
            <CalendarNotice
              title={t("tasks:myTasks.showingFirstPage", {
                shown: tasks.length,
                total: totalTasks,
              })}
              tone="muted"
            />
          ) : null}

          <MonthGrid
            weeks={weeks}
            tasks={scheduledTasks}
            visibleMonth={visibleMonth}
            maxLanes={isMobile ? MAX_LANES_MOBILE : MAX_LANES_DESKTOP}
            onOpenTask={openTask}
          />

          <WorkspacePermissionScope value={sheet.workspaceId}>
            <TaskDetailsSheet
              taskId={sheet.taskId}
              projectId={sheet.projectId ?? ""}
              workspaceId={sheet.workspaceId ?? ""}
              onClose={sheet.onClose}
            />
          </WorkspacePermissionScope>
        </div>
      </TaskViewProvider>
    </MyTasksLayout>
  );
}

const NOTICE_TONES = {
  default: "text-sm font-semibold text-foreground",
  muted: "text-sm text-muted-foreground",
  destructive: "text-sm font-semibold text-destructive",
};

function CalendarNotice({
  title,
  subtitle,
  tone = "default",
}: {
  title: string;
  subtitle?: string;
  tone?: keyof typeof NOTICE_TONES;
}) {
  return (
    <div className="border-b border-border/80 px-4 py-3 text-center">
      <p className={NOTICE_TONES[tone]}>{title}</p>
      {subtitle ? (
        <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}
