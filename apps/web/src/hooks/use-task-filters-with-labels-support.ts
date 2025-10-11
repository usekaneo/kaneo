import { useQueryClient } from "@tanstack/react-query";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { useCallback, useMemo, useState } from "react";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import type { BoardFilters } from "./use-task-filters";

export function useTaskFiltersWithLabelsSupport(
  project: ProjectWithTasks | null | undefined,
) {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<BoardFilters>({
    status: null,
    priority: null,
    assignee: null,
    dueDate: null,
    labels: null,
  });

  // Helper function to get cached labels for a task
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

  const filterTasks = useCallback(
    (tasks: Task[]): Task[] => {
      return tasks.filter((task) => {
        if (filters.status && task.status !== filters.status) {
          return false;
        }

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
            case "Due this week": {
              const weekStart = startOfWeek(today);
              const weekEnd = endOfWeek(today);
              if (
                !isWithinInterval(taskDate, { start: weekStart, end: weekEnd })
              ) {
                return false;
              }
              break;
            }
            case "Due next week": {
              const nextWeekStart = startOfWeek(addWeeks(today, 1));
              const nextWeekEnd = endOfWeek(addWeeks(today, 1));
              if (
                !isWithinInterval(taskDate, {
                  start: nextWeekStart,
                  end: nextWeekEnd,
                })
              ) {
                return false;
              }
              break;
            }
            case "No due date": {
              return false;
            }
          }
        }

        if (filters.dueDate === "No due date" && task.dueDate) {
          return false;
        }

        // Label filtering
        if (filters.labels && filters.labels.length > 0) {
          const taskLabels = getTaskLabels(task.id);
          const taskLabelIds = taskLabels.map((label) => label.id);

          // Check if task has at least one of the selected labels
          const hasMatchingLabel = filters.labels.some((labelId) =>
            taskLabelIds.includes(labelId),
          );

          if (!hasMatchingLabel) {
            return false;
          }
        }

        return true;
      });
    },
    [filters, getTaskLabels],
  );

  const filteredProject = useMemo(() => {
    if (!project) return null;

    return {
      ...project,
      columns:
        project.columns?.map((column) => ({
          ...column,
          tasks: filterTasks(column.tasks),
        })) ?? [],
    };
  }, [project, filterTasks]);

  const hasActiveFilters = Object.values(filters).some(
    (filter) => filter !== null,
  );

  const clearFilters = () => {
    setFilters({
      status: null,
      priority: null,
      assignee: null,
      dueDate: null,
      labels: null,
    });
  };

  const updateFilter = (
    key: keyof BoardFilters,
    value: string | string[] | null,
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const updateLabelFilter = (labelId: string) => {
    setFilters((prev) => {
      const currentLabels = prev.labels || [];
      const isSelected = currentLabels.includes(labelId);

      let newLabels: string[] | null;
      if (isSelected) {
        newLabels = currentLabels.filter((id) => id !== labelId);
        if (newLabels.length === 0) newLabels = null;
      } else {
        newLabels = [...currentLabels, labelId];
      }

      return { ...prev, labels: newLabels };
    });
  };

  return {
    filters,
    setFilters,
    updateFilter,
    updateLabelFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  };
}
