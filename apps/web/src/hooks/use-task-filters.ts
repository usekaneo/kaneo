import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { addWeeks, endOfWeek, isWithinInterval, startOfWeek } from "date-fns";
import { useState } from "react";

export interface BoardFilters {
  status: string | null;
  priority: string | null;
  assignee: string | null;
  dueDate: string | null;
}

export function useTaskFilters(project: ProjectWithTasks | null | undefined) {
  const [filters, setFilters] = useState<BoardFilters>({
    status: null,
    priority: null,
    assignee: null,
    dueDate: null,
  });

  const filterTasks = (tasks: Task[]): Task[] => {
    return tasks.filter((task) => {
      if (filters.status && task.status !== filters.status) {
        return false;
      }

      if (filters.priority && task.priority !== filters.priority) {
        return false;
      }

      if (filters.assignee && task.userEmail !== filters.assignee) {
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

      return true;
    });
  };

  const filteredProject = project
    ? {
        ...project,
        columns:
          project.columns?.map((column) => ({
            ...column,
            tasks: filterTasks(column.tasks),
          })) ?? [],
      }
    : null;

  const hasActiveFilters = Object.values(filters).some(
    (filter) => filter !== null,
  );

  const clearFilters = () => {
    setFilters({
      status: null,
      priority: null,
      assignee: null,
      dueDate: null,
    });
  };

  const updateFilter = (key: keyof BoardFilters, value: string | null) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  return {
    filters,
    setFilters,
    updateFilter,
    filteredProject,
    hasActiveFilters,
    clearFilters,
  };
}
