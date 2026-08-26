import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { Filter } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import SortControl from "@/components/common/sort-control";
import HierarchyView from "@/components/hierarchy-view";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import labelColors from "@/constants/label-colors";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { DUE_DATE_FILTER_VALUES } from "@/hooks/use-task-filters";
import { isTaskCompleted } from "@/lib/due-date-status";
import type { SortConfig } from "@/lib/sort-tasks";
import { sortTasks } from "@/lib/sort-tasks";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";

type HierarchySearchParams = { taskId?: string };
type CompletionFilter = "all" | "open" | "completed";
type DueDateFilter =
  | "all"
  | (typeof DUE_DATE_FILTER_VALUES)[keyof typeof DUE_DATE_FILTER_VALUES];

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/hierarchy",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): HierarchySearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useGetTasks(projectId);
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);
  const { project, setProject } = useProjectStore();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const [completionFilter, setCompletionFilter] =
    useState<CompletionFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState("all");
  const [dueDateFilter, setDueDateFilter] = useState<DueDateFilter>("all");
  const [labelFilters, setLabelFilters] = useState<string[]>([]);
  const [sort, setSort] = useState<SortConfig>({
    field: "position",
    direction: "asc",
  });

  useEffect(() => {
    if (data) setProject(data);
  }, [data, setProject]);

  const closeTask = useCallback(() => {
    navigate({ to: ".", search: {}, replace: true });
  }, [navigate]);

  const visibleTasks = useMemo(() => {
    if (!project) return [];

    const tasks = [
      ...project.plannedTasks,
      ...project.columns.flatMap((column) => column.tasks),
    ].filter((task) => {
      if (completionFilter !== "all") {
        const completed = isTaskCompleted(task.status, project.columns);
        if (completionFilter === "completed" ? !completed : completed) {
          return false;
        }
      }

      if (assigneeFilter === "unassigned" && task.userId) return false;
      if (
        assigneeFilter !== "all" &&
        assigneeFilter !== "unassigned" &&
        task.userId !== assigneeFilter
      ) {
        return false;
      }

      if (dueDateFilter !== "all") {
        if (dueDateFilter === DUE_DATE_FILTER_VALUES.noDueDate) {
          if (task.dueDate) return false;
        } else {
          if (!task.dueDate) return false;
          const today = new Date();
          const taskDate = new Date(task.dueDate);
          const weekOffset =
            dueDateFilter === DUE_DATE_FILTER_VALUES.dueNextWeek ? 1 : 0;
          const targetDate = addWeeks(today, weekOffset);
          if (
            !isWithinInterval(taskDate, {
              start: startOfWeek(targetDate, { weekStartsOn }),
              end: endOfWeek(targetDate, { weekStartsOn }),
            })
          ) {
            return false;
          }
        }
      }

      if (
        labelFilters.length > 0 &&
        !labelFilters.some((labelId) =>
          task.labels?.some((label) => label.id === labelId),
        )
      ) {
        return false;
      }

      return true;
    });

    return sortTasks(tasks, sort);
  }, [
    assigneeFilter,
    completionFilter,
    dueDateFilter,
    labelFilters,
    project,
    sort,
    weekStartsOn,
  ]);

  const activeFilterCount =
    Number(completionFilter !== "all") +
    Number(assigneeFilter !== "all") +
    Number(dueDateFilter !== "all") +
    Number(labelFilters.length > 0);
  const selectedAssignee = workspaceUsers?.members?.find(
    (member) => member.userId === assigneeFilter,
  );
  const filterLabel =
    activeFilterCount === 0
      ? t("tasks:hierarchy.filters.all")
      : activeFilterCount === 1
        ? completionFilter !== "all"
          ? t(`tasks:hierarchy.filters.${completionFilter}`)
          : assigneeFilter === "unassigned"
            ? t("tasks:hierarchy.filters.unassigned")
            : assigneeFilter !== "all"
              ? (selectedAssignee?.user?.name ??
                t("tasks:hierarchy.filters.assignee"))
              : dueDateFilter !== "all"
                ? t(`tasks:hierarchy.filters.${dueDateFilter}`)
                : t("tasks:hierarchy.filters.labels")
        : t("tasks:hierarchy.filters.selected", {
            count: activeFilterCount,
          });
  const hierarchyToolbar = (
    <div className="flex h-10 shrink-0 items-center gap-2 border-b border-border/80 bg-background px-3 sm:px-4">
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant={activeFilterCount === 0 ? "outline" : "secondary"}
              size="sm"
              className="h-7 gap-1.5 px-2.5 text-xs"
            />
          }
        >
          <Filter className="size-3.5" />
          {filterLabel}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {t("tasks:hierarchy.filters.label")}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={completionFilter}
            onValueChange={(value) =>
              setCompletionFilter(value as CompletionFilter)
            }
          >
            <DropdownMenuRadioItem value="all">
              {t("tasks:hierarchy.filters.all")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="open">
              {t("tasks:hierarchy.filters.open")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="completed">
              {t("tasks:hierarchy.filters.completed")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {t("tasks:hierarchy.filters.assignee")}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={assigneeFilter}
            onValueChange={setAssigneeFilter}
          >
            <DropdownMenuRadioItem value="all">
              {t("tasks:hierarchy.filters.allAssignees")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value="unassigned">
              {t("tasks:hierarchy.filters.unassigned")}
            </DropdownMenuRadioItem>
            {workspaceUsers?.members?.map((member) => (
              <DropdownMenuRadioItem key={member.userId} value={member.userId}>
                {member.user?.name ?? member.user?.email}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {t("tasks:hierarchy.filters.dueDate")}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={dueDateFilter}
            onValueChange={(value) => setDueDateFilter(value as DueDateFilter)}
          >
            <DropdownMenuRadioItem value="all">
              {t("tasks:hierarchy.filters.allDueDates")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value={DUE_DATE_FILTER_VALUES.dueThisWeek}>
              {t("tasks:hierarchy.filters.dueThisWeek")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value={DUE_DATE_FILTER_VALUES.dueNextWeek}>
              {t("tasks:hierarchy.filters.dueNextWeek")}
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem value={DUE_DATE_FILTER_VALUES.noDueDate}>
              {t("tasks:hierarchy.filters.noDueDate")}
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>
              {t("tasks:hierarchy.filters.labels")}
            </DropdownMenuLabel>
            {workspaceLabels.map((label) => (
              <DropdownMenuCheckboxItem
                key={label.id}
                checked={labelFilters.includes(label.id)}
                onCheckedChange={() =>
                  setLabelFilters((current) =>
                    current.includes(label.id)
                      ? current.filter((id) => id !== label.id)
                      : [...current, label.id],
                  )
                }
              >
                <span
                  className="size-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      labelColors.find((color) => color.value === label.color)
                        ?.color ?? "var(--color-stone-500)",
                  }}
                />
                {label.name}
              </DropdownMenuCheckboxItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      <SortControl sort={sort} onSortChange={setSort} />
    </div>
  );

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="hierarchy"
    >
      <PageTitle
        title={`${project?.name ?? ""} · ${t("tasks:hierarchy.title")}`}
        hideAppName
      />
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        {hierarchyToolbar}
        <div className="min-h-0 flex-1 overflow-hidden">
          {project ? (
            <HierarchyView
              project={project}
              tasks={visibleTasks}
              onOpenTask={(nextTaskId) =>
                navigate({ to: ".", search: { taskId: nextTaskId } })
              }
            />
          ) : (
            <div className="h-full animate-pulse bg-muted/20" />
          )}
        </div>
        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={closeTask}
        />
      </div>
    </ProjectLayout>
  );
}
