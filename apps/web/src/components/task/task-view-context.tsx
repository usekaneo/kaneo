import { createContext, type ReactNode, useContext } from "react";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";

/**
 * The project a task belongs to, as far as the task components need it: the
 * `SLUG-123` prefix, the workspace whose members can be assigned, and the
 * columns that decide completion and the "move to status" options.
 */
export type TaskProjectRef = {
  id: string;
  slug: string;
  workspaceId: string;
  columns: Array<{
    slug: string;
    name: string;
    icon: string | null;
    isFinal: boolean;
  }>;
};

export type TaskViewCapabilities = {
  /** Cmd/ctrl-click selection and the bulk toolbar. Off when the tasks shown may span workspaces. */
  bulkSelection: boolean;
  /** Per-column "add task" and "archive all". Off when a column aggregates several projects. */
  columnActions: boolean;
};

export type TaskViewContextValue = {
  getTaskProject: (task: { projectId: string }) => TaskProjectRef | undefined;
  getTaskProjectById: (taskId: string) => TaskProjectRef | undefined;
  capabilities: TaskViewCapabilities;
};

const DEFAULT_CAPABILITIES: TaskViewCapabilities = {
  bulkSelection: true,
  columnActions: true,
};

const TaskViewContext = createContext<TaskViewContextValue | null>(null);

export function TaskViewProvider({
  value,
  children,
}: {
  value: TaskViewContextValue;
  children: ReactNode;
}) {
  return (
    <TaskViewContext.Provider value={value}>
      {children}
    </TaskViewContext.Provider>
  );
}

function toProjectRef(
  project: ProjectWithTasks | undefined,
): TaskProjectRef | undefined {
  if (!project) return undefined;
  return {
    id: project.id,
    slug: project.slug,
    workspaceId: project.workspaceId,
    columns: project.columns,
  };
}

/**
 * Resolves the project of a task. Inside a `TaskViewProvider` (views that mix
 * projects) the lookup is per task; elsewhere it is the single project open in
 * the store, which is what the project routes have always used.
 */
export function useTaskProject(
  task: { projectId: string } | undefined,
): TaskProjectRef | undefined {
  const context = useContext(TaskViewContext);
  const project = useProjectStore((state) => state.project);
  if (context) {
    return task ? context.getTaskProject(task) : undefined;
  }
  return toProjectRef(project);
}

export function useTaskProjectById(
  taskId: string | null | undefined,
): TaskProjectRef | undefined {
  const context = useContext(TaskViewContext);
  const project = useProjectStore((state) => state.project);
  if (context) {
    return taskId ? context.getTaskProjectById(taskId) : undefined;
  }
  return toProjectRef(project);
}

export function useTaskViewCapabilities(): TaskViewCapabilities {
  return useContext(TaskViewContext)?.capabilities ?? DEFAULT_CAPABILITIES;
}
