import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  addMonths,
  isSameDay,
  parseISO,
  startOfMonth,
  subMonths,
} from "date-fns";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import CalendarToolbar from "@/components/calendar/calendar-toolbar";
import MonthAgenda from "@/components/calendar/month-agenda";
import MonthGrid from "@/components/calendar/month-grid";
import { moveCalendarTask } from "@/components/calendar/move-calendar-task";
import { buildMonthWeeks } from "@/components/calendar/month-grid-model";
import ProjectLayout from "@/components/common/project-layout";
import PageTitle from "@/components/page-title";
import { CalendarDisplayOptions } from "@/components/project/display/calendar-display-options";
import { DisplaySection } from "@/components/project/display/display-section";
import { WeekStartControl } from "@/components/project/display/week-start-control";
import { ActiveFiltersBar } from "@/components/project/task-filters/active-filters-bar";
import { ProjectToolbar } from "@/components/project/toolbar/project-toolbar";
import { TaskCount } from "@/components/project/toolbar/task-count";
import { useProjectTaskView } from "@/components/project/toolbar/use-project-task-view";
import { LayoutSwitch } from "@/components/project/views/layout-switch";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useIsMobile } from "@/hooks/use-mobile";
import { toCalendarTasks } from "@/lib/calendar-tasks";
import { toScheduledTask } from "@/lib/task-schedule";
import { toast } from "@/lib/toast";
import useGetProjectTaskRelations from "@/hooks/queries/task-relation/use-get-project-task-relations";
import { useUserPreferencesStore } from "@/store/user-preferences";

type CalendarSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/calendar",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): CalendarSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

// By default lanes are capped. The user can expand weeks to fit all tasks;
// phones continue to use the agenda list instead of the grid.
const MAX_LANES_DESKTOP = 3;
const NO_RELATIONS = [] as const;

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: project, isLoading, isError } = useGetTasks(projectId);
  const {
    data: relationData,
    isLoading: relationsLoading,
    isError: relationsError,
  } = useGetProjectTaskRelations(projectId);
  const relations = relationsError
    ? NO_RELATIONS
    : (relationData ?? NO_RELATIONS);
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const wrapTaskTitles = useUserPreferencesStore(
    (state) => state.calendarWrapTaskTitles,
  );
  const showAllTasks = useUserPreferencesStore(
    (state) => state.calendarShowAllTasks,
  );
  const isMobile = useIsMobile();
  const { mutateAsync: updateTask } = useUpdateTask();
  const moveInProgress = useRef(false);
  const [pendingMove, setPendingMove] = useState<{
    id: string;
    startDate: string | null;
    dueDate: string | null;
  } | null>(null);
  const view = useProjectTaskView({
    project,
    projectId,
    workspaceId,
    scope: "schedule",
  });
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );

  const allScheduledTasks = useMemo(
    () => toCalendarTasks(project, relations),
    [project, relations],
  );
  const scheduledTasks = useMemo(
    () => toCalendarTasks(project, relations, view.filters.filteredProject),
    [project, view.filters.filteredProject, relations],
  );

  // Keep the moved card on its new date until refreshed task data confirms it.
  const displayTasks = useMemo(
    () =>
      scheduledTasks.map((task) => {
        if (task.id !== pendingMove?.id) return task;
        return (
          toScheduledTask({
            ...task,
            startDate: pendingMove.startDate,
            dueDate: pendingMove.dueDate,
          }) ?? task
        );
      }),
    [scheduledTasks, pendingMove],
  );

  useEffect(() => {
    if (!pendingMove) return;
    const task = scheduledTasks.find((item) => item.id === pendingMove.id);
    if (!task) return;
    const matches = (actual: string | null, expected: string | null) =>
      actual && expected
        ? isSameDay(parseISO(actual), parseISO(expected))
        : actual === expected;
    if (
      matches(task.startDate, pendingMove.startDate) &&
      matches(task.dueDate, pendingMove.dueDate)
    ) {
      setPendingMove(null);
    }
  }, [scheduledTasks, pendingMove]);

  const handleMoveTask = useCallback(
    async (taskId: string, targetDay: Date) => {
      if (moveInProgress.current) return;
      const task = displayTasks.find((item) => item.id === taskId);
      if (!task || task.subtasks?.length) return;
      const updated = moveCalendarTask(task, targetDay);
      if (!updated) return;

      moveInProgress.current = true;
      setPendingMove({
        id: taskId,
        startDate: updated.startDate,
        dueDate: updated.dueDate,
      });
      try {
        await updateTask(updated);
      } catch (error) {
        setPendingMove(null);
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:gantt.updateDatesError"),
        );
      } finally {
        moveInProgress.current = false;
      }
    },
    [displayTasks, updateTask, t],
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

  const handleOpenTask = useCallback(
    (nextTaskId: string) => {
      navigate({ to: ".", search: { taskId: nextTaskId }, replace: true });
    },
    [navigate],
  );

  const handleCloseTaskSheet = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="calendar"
      toolbar={
        <ProjectToolbar
          view={view}
          display={
            <>
              <DisplaySection>
                <LayoutSwitch
                  workspaceId={workspaceId}
                  projectId={projectId}
                  currentRoute="calendar"
                  currentView="calendar"
                />
              </DisplaySection>
              <DisplaySection>
                <WeekStartControl />
              </DisplaySection>
              <DisplaySection>
                <CalendarDisplayOptions />
              </DisplaySection>
            </>
          }
        />
      }
      summary={
        <TaskCount
          shown={scheduledTasks.length}
          total={allScheduledTasks.length}
        />
      }
      filterBar={
        <ActiveFiltersBar
          subjects={view.subjects}
          onClear={view.filters.clearFilters}
          customFieldValues={view.filters.customFieldValues}
        />
      }
    >
      <PageTitle
        title={
          project
            ? t("tasks:calendar.pageTitle", { name: project.name })
            : undefined
        }
      />
      <div className="flex h-full min-h-0 flex-col bg-background">
        <CalendarToolbar
          visibleMonth={visibleMonth}
          onPreviousMonth={handlePreviousMonth}
          onNextMonth={handleNextMonth}
          onToday={handleToday}
        />

        {isLoading || relationsLoading ? (
          <div className="border-b border-border/80 px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">
              {t("common:empty.loading")}
            </p>
          </div>
        ) : isError ? (
          <div className="border-b border-border/80 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-destructive">
              {t("tasks:calendar.loadError")}
            </p>
          </div>
        ) : allScheduledTasks.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-foreground">
              {t("tasks:calendar.noTasks")}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("tasks:calendar.noTasksSubtitle")}
            </p>
          </div>
        ) : scheduledTasks.length === 0 ? (
          <div className="border-b border-border/80 px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">
              {t("tasks:filterBar.noMatches")}
            </p>
          </div>
        ) : null}

        {!isLoading &&
          !relationsLoading &&
          !isError &&
          (isMobile ? (
            scheduledTasks.length > 0 && (
              <MonthAgenda
                tasks={scheduledTasks}
                visibleMonth={visibleMonth}
                projectSlug={project?.slug}
                onOpenTask={handleOpenTask}
              />
            )
          ) : (
            <MonthGrid
              weeks={weeks}
              tasks={displayTasks}
              visibleMonth={visibleMonth}
              maxLanes={MAX_LANES_DESKTOP}
              wrapTaskTitles={wrapTaskTitles}
              showAllTasks={showAllTasks}
              projectSlug={project?.slug}
              onOpenTask={handleOpenTask}
              onMoveTask={handleMoveTask}
            />
          ))}

        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={handleCloseTaskSheet}
        />
      </div>
    </ProjectLayout>
  );
}
