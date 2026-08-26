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
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
type CompletionFilter = "open" | "completed";
type RelationFilter = "related" | "standalone";
type DueDateFilter =
  (typeof DUE_DATE_FILTER_VALUES)[keyof typeof DUE_DATE_FILTER_VALUES];

function toggleFilter<T>(values: T[], value: T): T[] {
  return values.includes(value)
    ? values.filter((item) => item !== value)
    : [...values, value];
}

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
  const [completionFilters, setCompletionFilters] = useState<
    CompletionFilter[]
  >([]);
  const [relationFilters, setRelationFilters] = useState<RelationFilter[]>([]);
  const [assigneeFilters, setAssigneeFilters] = useState<string[]>([]);
  const [dueDateFilters, setDueDateFilters] = useState<DueDateFilter[]>([]);
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
    const relatedTaskIds = new Set(
      (project.subtaskRelations ?? []).flatMap((relation) => [
        relation.sourceTaskId,
        relation.targetTaskId,
      ]),
    );

    const tasks = [
      ...project.plannedTasks,
      ...project.columns.flatMap((column) => column.tasks),
    ].filter((task) => {
      if (
        relationFilters.length > 0 &&
        !relationFilters.some((filter) =>
          filter === "related"
            ? relatedTaskIds.has(task.id)
            : !relatedTaskIds.has(task.id),
        )
      ) {
        return false;
      }

      if (completionFilters.length > 0) {
        const completed = isTaskCompleted(task.status, project.columns);
        if (
          !completionFilters.some((filter) =>
            filter === "completed" ? completed : !completed,
          )
        ) {
          return false;
        }
      }

      if (
        assigneeFilters.length > 0 &&
        !assigneeFilters.includes(task.userId ?? "unassigned")
      ) {
        return false;
      }

      if (dueDateFilters.length > 0) {
        const matchesDueDate = dueDateFilters.some((filter) => {
          if (filter === DUE_DATE_FILTER_VALUES.noDueDate) {
            return !task.dueDate;
          }
          if (!task.dueDate) return false;

          const today = new Date();
          const taskDate = new Date(task.dueDate);
          const weekOffset =
            filter === DUE_DATE_FILTER_VALUES.dueNextWeek ? 1 : 0;
          const targetDate = addWeeks(today, weekOffset);
          return isWithinInterval(taskDate, {
            start: startOfWeek(targetDate, { weekStartsOn }),
            end: endOfWeek(targetDate, { weekStartsOn }),
          });
        });
        if (!matchesDueDate) return false;
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
    assigneeFilters,
    completionFilters,
    dueDateFilters,
    labelFilters,
    project,
    relationFilters,
    sort,
    weekStartsOn,
  ]);

  const activeFilterCount =
    Number(completionFilters.length > 0) +
    Number(relationFilters.length > 0) +
    Number(assigneeFilters.length > 0) +
    Number(dueDateFilters.length > 0) +
    Number(labelFilters.length > 0);
  const filterLabel =
    activeFilterCount === 0
      ? t("tasks:hierarchy.filters.all")
      : t("tasks:hierarchy.filters.selected", { count: activeFilterCount });
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
              {t("tasks:hierarchy.filters.filterBy")}
            </DropdownMenuLabel>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("tasks:hierarchy.filters.relation")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuCheckboxItem
                  checked={relationFilters.length === 0}
                  indicatorVariant="checkbox"
                  onCheckedChange={() => setRelationFilters([])}
                >
                  {t("tasks:hierarchy.filters.allRelations")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={relationFilters.includes("related")}
                  indicatorVariant="checkbox"
                  onCheckedChange={() =>
                    setRelationFilters((current) =>
                      toggleFilter(current, "related"),
                    )
                  }
                >
                  {t("tasks:hierarchy.filters.related")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={relationFilters.includes("standalone")}
                  indicatorVariant="checkbox"
                  onCheckedChange={() =>
                    setRelationFilters((current) =>
                      toggleFilter(current, "standalone"),
                    )
                  }
                >
                  {t("tasks:hierarchy.filters.standalone")}
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("tasks:hierarchy.filters.label")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuCheckboxItem
                  checked={completionFilters.length === 0}
                  indicatorVariant="checkbox"
                  onCheckedChange={() => setCompletionFilters([])}
                >
                  {t("tasks:hierarchy.filters.all")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={completionFilters.includes("open")}
                  indicatorVariant="checkbox"
                  onCheckedChange={() =>
                    setCompletionFilters((current) =>
                      toggleFilter(current, "open"),
                    )
                  }
                >
                  {t("tasks:hierarchy.filters.open")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={completionFilters.includes("completed")}
                  indicatorVariant="checkbox"
                  onCheckedChange={() =>
                    setCompletionFilters((current) =>
                      toggleFilter(current, "completed"),
                    )
                  }
                >
                  {t("tasks:hierarchy.filters.completed")}
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("tasks:hierarchy.filters.assignee")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuCheckboxItem
                  checked={assigneeFilters.length === 0}
                  indicatorVariant="checkbox"
                  onCheckedChange={() => setAssigneeFilters([])}
                >
                  {t("tasks:hierarchy.filters.allAssignees")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={assigneeFilters.includes("unassigned")}
                  indicatorVariant="checkbox"
                  onCheckedChange={() =>
                    setAssigneeFilters((current) =>
                      toggleFilter(current, "unassigned"),
                    )
                  }
                >
                  {t("tasks:hierarchy.filters.unassigned")}
                </DropdownMenuCheckboxItem>
                {workspaceUsers?.members?.map((member) => (
                  <DropdownMenuCheckboxItem
                    key={member.userId}
                    checked={assigneeFilters.includes(member.userId)}
                    indicatorVariant="checkbox"
                    onCheckedChange={() =>
                      setAssigneeFilters((current) =>
                        toggleFilter(current, member.userId),
                      )
                    }
                  >
                    {member.user?.name ?? member.user?.email}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("tasks:hierarchy.filters.dueDate")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              <DropdownMenuGroup>
                <DropdownMenuCheckboxItem
                  checked={dueDateFilters.length === 0}
                  indicatorVariant="checkbox"
                  onCheckedChange={() => setDueDateFilters([])}
                >
                  {t("tasks:hierarchy.filters.allDueDates")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={dueDateFilters.includes(
                    DUE_DATE_FILTER_VALUES.dueThisWeek,
                  )}
                  indicatorVariant="checkbox"
                  onCheckedChange={() =>
                    setDueDateFilters((current) =>
                      toggleFilter(current, DUE_DATE_FILTER_VALUES.dueThisWeek),
                    )
                  }
                >
                  {t("tasks:hierarchy.filters.dueThisWeek")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={dueDateFilters.includes(
                    DUE_DATE_FILTER_VALUES.dueNextWeek,
                  )}
                  indicatorVariant="checkbox"
                  onCheckedChange={() =>
                    setDueDateFilters((current) =>
                      toggleFilter(current, DUE_DATE_FILTER_VALUES.dueNextWeek),
                    )
                  }
                >
                  {t("tasks:hierarchy.filters.dueNextWeek")}
                </DropdownMenuCheckboxItem>
                <DropdownMenuCheckboxItem
                  checked={dueDateFilters.includes(
                    DUE_DATE_FILTER_VALUES.noDueDate,
                  )}
                  indicatorVariant="checkbox"
                  onCheckedChange={() =>
                    setDueDateFilters((current) =>
                      toggleFilter(current, DUE_DATE_FILTER_VALUES.noDueDate),
                    )
                  }
                >
                  {t("tasks:hierarchy.filters.noDueDate")}
                </DropdownMenuCheckboxItem>
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("tasks:hierarchy.filters.labels")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              <DropdownMenuGroup>
                <DropdownMenuCheckboxItem
                  checked={labelFilters.length === 0}
                  indicatorVariant="checkbox"
                  onCheckedChange={() => setLabelFilters([])}
                >
                  {t("tasks:boardFilters.allLabels")}
                </DropdownMenuCheckboxItem>
                {workspaceLabels.map((label) => (
                  <DropdownMenuCheckboxItem
                    key={label.id}
                    checked={labelFilters.includes(label.id)}
                    indicatorVariant="checkbox"
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
                          labelColors.find(
                            (color) => color.value === label.color,
                          )?.color ?? "var(--color-stone-500)",
                      }}
                    />
                    {label.name}
                  </DropdownMenuCheckboxItem>
                ))}
              </DropdownMenuGroup>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
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
