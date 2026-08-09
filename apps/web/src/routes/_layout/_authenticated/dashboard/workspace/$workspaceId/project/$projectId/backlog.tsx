import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { produce } from "immer";
import { ArrowRight, Calendar, Filter, Plus, User, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import BacklogListView from "@/components/backlog-list-view";
import ProjectLayout from "@/components/common/project-layout";
import SortControl from "@/components/common/sort-control";
import PageTitle from "@/components/page-title";
import CreateTaskModal from "@/components/shared/modals/create-task-modal";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/menu";
import labelColors from "@/constants/label-colors";
import { shortcuts } from "@/constants/shortcuts";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import useGetCachedCustomFieldValues from "@/hooks/queries/custom-field/use-get-all-custom-field-values-by-project";
import useGetCustomFieldFilterValues from "@/hooks/queries/custom-field/use-get-custom-field-filter-values";
import useGetCustomFieldsByProject from "@/hooks/queries/custom-field/use-get-custom-fields-by-project";
import useGetLabelsByWorkspace from "@/hooks/queries/label/use-get-labels-by-workspace";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useRegisterShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { DUE_DATE_FILTER_VALUES } from "@/hooks/use-task-filters";
import { getInitials } from "@/lib/get-initials";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import type { SortConfig } from "@/lib/sort-tasks";
import { sortTasks } from "@/lib/sort-tasks";
import { toast } from "@/lib/toast";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";

type BacklogSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/backlog",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): BacklogSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data } = useGetTasks(projectId);
  const { project, setProject } = useProjectStore();
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const { mutate: updateTask } = useUpdateTask();
  const [sort, setSort] = useState<SortConfig>({
    field: "position",
    direction: "asc",
  });

  const { data: users } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: workspaceLabels = [] } = useGetLabelsByWorkspace(workspaceId);
  const queryClient = useQueryClient();

  const { data: rawCustomFields = [] } = useGetCustomFieldsByProject(projectId);
  const { data: filterValuesData = [] } =
    useGetCustomFieldFilterValues(projectId);
  const { getValuesForTask } = useGetCachedCustomFieldValues();

  const usedCustomFieldValues = useMemo<Record<string, string[]>>(
    () =>
      Object.fromEntries(filterValuesData.map((f) => [f.fieldId, f.values])),
    [filterValuesData],
  );

  const handleCloseTaskSheet = useCallback(() => {
    navigate({
      to: ".",
      search: {},
      replace: true,
    });
  }, [navigate]);

  const { setViewMode } = useUserPreferencesStore();

  useRegisterShortcuts({
    sequentialShortcuts: {
      [shortcuts.view.prefix]: {
        [shortcuts.view.board]: () => {
          setViewMode("board");
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.list]: () => {
          setViewMode("list");
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/board",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.gantt]: () => {
          navigate({
            to: "/dashboard/workspace/$workspaceId/project/$projectId/gantt",
            params: { workspaceId, projectId },
          });
        },
        [shortcuts.view.backlog]: () => {},
      },
    },
  });

  const [filters, setFilters] = useState({
    priority: null as string | null,
    assignee: null as string | null,
    dueDate: null as string | null,
    labels: [] as string[],
    customFields: {} as Record<string, string[]>,
  });

  const updateFilter = (key: string, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateLabelFilter = (labelId: string) => {
    setFilters((prev) => ({
      ...prev,
      labels: prev.labels.includes(labelId)
        ? prev.labels.filter((id) => id !== labelId)
        : [...prev.labels, labelId],
    }));
  };

  const updateCustomFieldFilter = (fieldId: string, value: string) => {
    setFilters((prev) => {
      const existing = prev.customFields[fieldId] ?? [];
      const next = existing.includes(value)
        ? existing.filter((v) => v !== value)
        : [...existing, value];
      const updated = { ...prev.customFields };
      if (next.length > 0) {
        updated[fieldId] = next;
      } else {
        delete updated[fieldId];
      }
      return { ...prev, customFields: updated };
    });
  };

  const clearCustomFieldFilter = (fieldId: string) => {
    setFilters((prev) => {
      const updated = { ...prev.customFields };
      delete updated[fieldId];
      return { ...prev, customFields: updated };
    });
  };

  const clearFilters = () => {
    setFilters({
      priority: null,
      assignee: null,
      dueDate: null,
      labels: [],
      customFields: {},
    });
  };

  const hasActiveFilters = Object.values(filters).some((filter) => {
    if (Array.isArray(filter)) {
      return filter.length > 0;
    }

    if (filter && typeof filter === "object") {
      return Object.keys(filter).length > 0;
    }

    return filter !== null && filter !== undefined;
  });

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  const getAssigneeDisplayName = (userId: string) => {
    const member = users?.members?.find((m) => m.userId === userId);
    return member?.user?.name || t("common:people.unknown");
  };

  const getTaskLabels = useCallback(
    (taskId: string) => {
      const queryKey = ["labels", taskId];
      const cachedData = queryClient.getQueryData(queryKey) as
        | Array<{ id: string; name: string; color: string }>
        | undefined;
      return cachedData || [];
    },
    [queryClient],
  );

  const filteredProject = useMemo(() => {
    if (!project) return null;

    const filterTasks = (tasks: Task[]) => {
      return tasks.filter((task) => {
        if (filters.priority && task.priority !== filters.priority) {
          return false;
        }

        if (filters.assignee && task.userId !== filters.assignee) {
          return false;
        }

        if (filters.dueDate && task.dueDate) {
          const today = new Date();
          const taskDate = new Date(task.dueDate);

          switch (filters.dueDate) {
            case DUE_DATE_FILTER_VALUES.dueThisWeek: {
              const weekStart = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate() - today.getDay(),
              );
              const weekEnd = new Date(
                weekStart.getTime() + 6 * 24 * 60 * 60 * 1000,
              );
              if (taskDate < weekStart || taskDate > weekEnd) {
                return false;
              }
              break;
            }
            case DUE_DATE_FILTER_VALUES.dueNextWeek: {
              const nextWeekStart = new Date(
                today.getFullYear(),
                today.getMonth(),
                today.getDate() - today.getDay() + 7,
              );
              const nextWeekEnd = new Date(
                nextWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000,
              );
              if (taskDate < nextWeekStart || taskDate > nextWeekEnd) {
                return false;
              }
              break;
            }
            case DUE_DATE_FILTER_VALUES.noDueDate: {
              return false;
            }
          }
        }

        if (
          filters.dueDate === DUE_DATE_FILTER_VALUES.noDueDate &&
          task.dueDate
        ) {
          return false;
        }

        if (filters.labels.length > 0) {
          const taskLabels = getTaskLabels(task.id);
          const taskLabelIds = taskLabels.map((label) => label.id);
          const hasMatchingLabel = filters.labels.some((filterLabelId) =>
            taskLabelIds.includes(filterLabelId),
          );
          if (!hasMatchingLabel) {
            return false;
          }
        }

        if (Object.keys(filters.customFields).length > 0) {
          const taskFieldValues = getValuesForTask(task.id);
          const allMatch = Object.entries(filters.customFields).every(
            ([fieldId, selectedVals]) => {
              if (!selectedVals.length) return true;
              const entry = taskFieldValues.find((v) => v.fieldId === fieldId);
              return entry?.value != null && selectedVals.includes(entry.value);
            },
          );
          if (!allMatch) return false;
        }

        return true;
      });
    };

    return {
      ...project,
      plannedTasks: filterTasks(project.plannedTasks || []),
      archivedTasks: filterTasks(project.archivedTasks || []),
    };
  }, [project, filters, getTaskLabels, getValuesForTask]);

  const uniqueLabels = workspaceLabels.reduce(
    (
      acc: { id: string; name: string; color: string }[],
      label: { id: string; name: string; color: string },
    ) => {
      const existing = acc.find(
        (l) => l.name === label.name && l.color === label.color,
      );
      if (!existing) {
        acc.push(label);
      }
      return acc;
    },
    [],
  );

  const isLabelGroupSelected = (label: { name: string; color: string }) => {
    return workspaceLabels
      .filter(
        (l: { name: string; color: string }) =>
          l.name === label.name && l.color === label.color,
      )
      .some((l: { id: string }) => filters.labels?.includes(l.id));
  };

  const toggleLabelGroup = (label: { name: string; color: string }) => {
    const matchingLabels = workspaceLabels.filter(
      (l: { name: string; color: string }) =>
        l.name === label.name && l.color === label.color,
    );

    const isAnySelected = matchingLabels.some((l: { id: string }) =>
      filters.labels?.includes(l.id),
    );

    if (isAnySelected) {
      for (const l of matchingLabels) {
        if (filters.labels?.includes(l.id)) {
          updateLabelFilter(l.id);
        }
      }
    } else {
      for (const l of matchingLabels) {
        if (!filters.labels?.includes(l.id)) {
          updateLabelFilter(l.id);
        }
      }
    }
  };

  const sortedProject = useMemo(() => {
    if (!filteredProject || sort.field === "position") return filteredProject;
    return {
      ...filteredProject,
      plannedTasks: sortTasks(filteredProject.plannedTasks || [], sort),
      archivedTasks: sortTasks(filteredProject.archivedTasks || [], sort),
    };
  }, [filteredProject, sort]);

  const handleMoveAllPlannedToTodo = () => {
    if (!project) return;

    const plannedTasks = project.plannedTasks || [];

    if (plannedTasks.length === 0) {
      toast.info(t("tasks:backlog.noTasksToMove"));
      return;
    }

    if (
      !confirm(
        t("tasks:backlog.moveAllConfirm", { count: plannedTasks.length }),
      )
    ) {
      return;
    }

    for (const task of plannedTasks) {
      updateTask({
        ...task,
        status: "to-do",
      });
    }

    const updatedProject = produce(project, (draft) => {
      const todoColumn = draft.columns?.find((col) => col.id === "to-do");
      if (todoColumn && draft.plannedTasks) {
        todoColumn.tasks.push(
          ...draft.plannedTasks.map((task) => ({
            ...task,
            status: "to-do",
          })),
        );

        draft.plannedTasks = [];
      }
    });

    setProject(updatedProject);
    toast.success(
      t("tasks:backlog.moveAllSuccess", { count: plannedTasks.length }),
    );
  };

  return (
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="backlog"
    >
      <PageTitle
        title={t("tasks:backlog.pageTitle", { name: project?.name })}
      />
      <div className="relative flex flex-col h-full min-h-0 overflow-hidden">
        <div className="border-border/80 border-b bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/70">
          <div className="flex min-h-12 items-center px-3 py-2 md:px-4">
            <div className="flex w-full items-center gap-2">
              <div className="flex w-full flex-wrap items-center gap-1.5">
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => setIsTaskModalOpen(true)}
                  className="h-6 px-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  {t("tasks:backlog.plan")}
                </Button>

                <Button
                  variant="ghost"
                  size="xs"
                  onClick={handleMoveAllPlannedToTodo}
                  className="h-6 px-2 text-xs text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  title={t("tasks:backlog.moveAllTooltip")}
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  {t("tasks:backlog.moveAll")}
                </Button>

                {filters.priority && (
                  <Button
                    variant="secondary"
                    size="xs"
                    className="h-7 rounded-md px-2 text-xs font-medium gap-1.5"
                  >
                    {getPriorityIcon(filters.priority)}
                    <span>
                      {t("tasks:backlog.filters.priority", {
                        name: getPriorityLabel(filters.priority),
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFilter("priority", null);
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </Button>
                )}

                {filters.assignee && (
                  <Button
                    variant="secondary"
                    size="xs"
                    className="h-7 rounded-md px-2 text-xs font-medium gap-1.5"
                  >
                    <User className="h-3 w-3" />
                    <span>
                      {t("tasks:backlog.filters.assignee", {
                        name: getAssigneeDisplayName(filters.assignee),
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFilter("assignee", null);
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </Button>
                )}

                {filters.dueDate && (
                  <Button
                    variant="secondary"
                    size="xs"
                    className="h-7 rounded-md px-2 text-xs font-medium gap-1.5"
                  >
                    <Calendar className="h-3 w-3" />
                    <span>
                      {t("tasks:backlog.filters.due", {
                        date: t(
                          filters.dueDate === DUE_DATE_FILTER_VALUES.dueThisWeek
                            ? "tasks:backlog.filters.dueThisWeek"
                            : filters.dueDate ===
                                DUE_DATE_FILTER_VALUES.dueNextWeek
                              ? "tasks:backlog.filters.dueNextWeek"
                              : "tasks:backlog.filters.noDueDate",
                          { defaultValue: filters.dueDate },
                        ),
                      })}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateFilter("dueDate", null);
                      }}
                    >
                      <X className="h-2.5 w-2.5" />
                    </Button>
                  </Button>
                )}

                {filters.labels &&
                  filters.labels.length > 0 &&
                  uniqueLabels
                    .filter((uniqueLabel) =>
                      workspaceLabels
                        .filter(
                          (l: { name: string; color: string }) =>
                            l.name === uniqueLabel.name &&
                            l.color === uniqueLabel.color,
                        )
                        .some((l: { id: string }) =>
                          filters.labels?.includes(l.id),
                        ),
                    )
                    .map((label) => (
                      <Button
                        key={`${label.name}-${label.color}`}
                        variant="secondary"
                        size="xs"
                        className="h-7 rounded-md px-2 text-xs font-medium gap-1.5"
                      >
                        <span
                          className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                          style={{
                            backgroundColor:
                              labelColors.find((c) => c.value === label.color)
                                ?.color || "var(--color-neutral-400)",
                          }}
                        />
                        <span>
                          {t("tasks:backlog.filters.label", {
                            name: label.name,
                          })}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleLabelGroup(label);
                          }}
                        >
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </Button>
                    ))}

                {Object.entries(filters.customFields).map(([fieldId, vals]) => {
                  if (!vals.length) return null;
                  const field = rawCustomFields.find((f) => f.id === fieldId);
                  if (!field) return null;
                  return (
                    <Button
                      key={fieldId}
                      variant="secondary"
                      size="xs"
                      className="h-7 rounded-md px-2 text-xs font-medium gap-1.5"
                    >
                      <span>{field.name}</span>
                      <span className="text-muted-foreground">:</span>
                      <span>
                        {vals.length === 1
                          ? field.type === "boolean"
                            ? vals[0] === "true"
                              ? "True"
                              : "False"
                            : vals[0]
                          : t("tasks:boardFilters.selectedCount", {
                              count: vals.length,
                              defaultValue: `${vals.length} selected`,
                            })}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-4 w-4 p-0 ml-1 hover:bg-destructive hover:text-destructive-foreground"
                        onClick={(e) => {
                          e.stopPropagation();
                          clearCustomFieldFilter(fieldId);
                        }}
                      >
                        <X className="h-2.5 w-2.5" />
                      </Button>
                    </Button>
                  );
                })}

                <SortControl sort={sort} onSortChange={setSort} />

                <DropdownMenu>
                  <DropdownMenuTrigger
                    render={
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-2 px-2.5 text-xs font-medium text-foreground"
                      />
                    }
                  >
                    <Filter className="h-3.5 w-3.5" />
                    {t("tasks:backlog.filter")}
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-80" align="start">
                    <DropdownMenuItem
                      disabled
                      className="h-8 rounded-md border border-border/80 bg-card text-sm text-muted-foreground"
                    >
                      {t("tasks:backlog.addFilter")}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    {hasActiveFilters && (
                      <>
                        <DropdownMenuItem
                          onClick={clearFilters}
                          className="h-8 text-sm text-muted-foreground"
                        >
                          <span>{t("common:actions.clearAllFilters")}</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                      </>
                    )}
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                        {t("tasks:priority.label")}
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {["urgent", "high", "medium", "low"].map((priority) => (
                      <DropdownMenuCheckboxItem
                        key={priority}
                        checked={filters.priority === priority}
                        onCheckedChange={(checked) =>
                          updateFilter("priority", checked ? priority : null)
                        }
                        className="h-8 rounded-md text-sm [&_svg]:text-sidebar-foreground"
                      >
                        <div className="flex gap-2 items-center">
                          {getPriorityIcon(priority)}
                          <span className="capitalize">
                            {getPriorityLabel(priority)}
                          </span>
                        </div>
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                        {t("tasks:assignee.label")}
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {users?.members?.map((member) => (
                      <DropdownMenuCheckboxItem
                        key={member.userId}
                        checked={filters.assignee === member.userId}
                        onCheckedChange={(checked) =>
                          updateFilter(
                            "assignee",
                            checked ? member.userId : null,
                          )
                        }
                        className="h-8 rounded-md text-sm"
                      >
                        <Avatar className="h-6 w-6 mr-2">
                          <AvatarImage
                            src={member.user?.image ?? ""}
                            alt={member.user?.name || ""}
                          />
                          <AvatarFallback className="text-xs font-medium border border-border/30">
                            {getInitials(member.user?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span>{member.user?.name}</span>
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                        {t("tasks:dueDate.label")}
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {[
                      {
                        label: DUE_DATE_FILTER_VALUES.dueThisWeek,
                        key: "dueThisWeek",
                      },
                      {
                        label: DUE_DATE_FILTER_VALUES.dueNextWeek,
                        key: "dueNextWeek",
                      },
                      {
                        label: DUE_DATE_FILTER_VALUES.noDueDate,
                        key: "noDueDate",
                      },
                    ].map((item) => (
                      <DropdownMenuCheckboxItem
                        key={item.label}
                        checked={filters.dueDate === item.label}
                        onCheckedChange={(checked) =>
                          updateFilter("dueDate", checked ? item.label : null)
                        }
                        className="h-8 rounded-md text-sm"
                      >
                        <span>{t(`tasks:backlog.filters.${item.key}`)}</span>
                      </DropdownMenuCheckboxItem>
                    ))}

                    <DropdownMenuSeparator />
                    <DropdownMenuGroup>
                      <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                        {t("tasks:labels.label")}
                      </DropdownMenuLabel>
                    </DropdownMenuGroup>
                    {uniqueLabels.length > 0 ? (
                      uniqueLabels.map(
                        (label: {
                          id: string;
                          name: string;
                          color: string;
                        }) => (
                          <DropdownMenuCheckboxItem
                            key={label.id}
                            checked={isLabelGroupSelected(label)}
                            onCheckedChange={() => toggleLabelGroup(label)}
                            className="h-8 rounded-md text-sm"
                          >
                            <span
                              className="w-3 h-3 rounded-full flex-shrink-0"
                              style={{
                                backgroundColor:
                                  labelColors.find(
                                    (c) => c.value === label.color,
                                  )?.color || "var(--color-neutral-400)",
                              }}
                            />
                            <span className="max-w-20 truncate">
                              {label.name}
                            </span>
                          </DropdownMenuCheckboxItem>
                        ),
                      )
                    ) : (
                      <DropdownMenuItem
                        disabled
                        className="h-8 rounded-md text-sm text-muted-foreground"
                      >
                        <span>{t("tasks:labels.empty")}</span>
                      </DropdownMenuItem>
                    )}
                    {rawCustomFields.length > 0 && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuGroup>
                          <DropdownMenuLabel className="text-[11px] uppercase tracking-wide">
                            Custom Fields
                          </DropdownMenuLabel>
                        </DropdownMenuGroup>

                        {rawCustomFields.map((field) => {
                          const selectedVals =
                            filters.customFields[field.id] ?? [];

                          let displayOptions: string[] = [];
                          if (field.type === "dropdown") {
                            displayOptions = Array.isArray(field.options)
                              ? (field.options as string[])
                              : [];
                          } else if (field.type === "boolean") {
                            displayOptions = ["true", "false"];
                          } else {
                            displayOptions =
                              usedCustomFieldValues[field.id] ?? [];
                          }

                          const labelForOption = (opt: string) => {
                            if (field.type === "boolean")
                              return opt === "true" ? "True" : "False";
                            return opt;
                          };

                          return (
                            <DropdownMenuSub key={field.id}>
                              <DropdownMenuSubTrigger className="h-8 rounded-md text-sm">
                                <span className="flex flex-1 items-center justify-between gap-2">
                                  <span className="truncate">{field.name}</span>
                                  {selectedVals.length > 0 && (
                                    <span className="ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground">
                                      {selectedVals.length}
                                    </span>
                                  )}
                                </span>
                              </DropdownMenuSubTrigger>
                              <DropdownMenuSubContent className="w-48">
                                {selectedVals.length > 0 && (
                                  <>
                                    <DropdownMenuItem
                                      onClick={() =>
                                        clearCustomFieldFilter(field.id)
                                      }
                                      className="h-8 rounded-md text-sm text-muted-foreground"
                                    >
                                      {t("common:actions.clearAllFilters", {
                                        defaultValue: "Clear",
                                      })}
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                  </>
                                )}
                                {displayOptions.length === 0 ? (
                                  <DropdownMenuItem
                                    disabled
                                    className="h-8 rounded-md text-sm text-muted-foreground"
                                  >
                                    {t("tasks:boardFilters.noValuesUsedYet")}
                                  </DropdownMenuItem>
                                ) : (
                                  displayOptions.map((option) => (
                                    <DropdownMenuCheckboxItem
                                      key={option}
                                      checked={selectedVals.includes(option)}
                                      onCheckedChange={() =>
                                        updateCustomFieldFilter(
                                          field.id,
                                          option,
                                        )
                                      }
                                      className="h-8 rounded-md text-sm"
                                    >
                                      <span className="truncate">
                                        {labelForOption(option)}
                                      </span>
                                    </DropdownMenuCheckboxItem>
                                  ))
                                )}
                              </DropdownMenuSubContent>
                            </DropdownMenuSub>
                          );
                        })}
                      </>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-hidden bg-card h-full">
          {sortedProject ? (
            <BacklogListView
              project={sortedProject}
              disableDragDrop={sort.field !== "position"}
            />
          ) : (
            <div className="flex h-full items-center justify-center">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 bg-muted rounded-lg animate-pulse mx-auto" />
                <div className="space-y-2">
                  <div className="w-48 h-4 bg-muted rounded animate-pulse mx-auto" />
                  <div className="w-64 h-3 bg-muted rounded animate-pulse mx-auto" />
                </div>
              </div>
            </div>
          )}
        </div>

        <CreateTaskModal
          open={isTaskModalOpen}
          projectId={projectId}
          onClose={() => setIsTaskModalOpen(false)}
          status="planned"
        />

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
