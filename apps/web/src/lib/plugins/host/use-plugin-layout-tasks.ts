import type { ProjectViewScope, ProjectViewState } from "@kaneo/plugin-sdk/web";
import { useMemo } from "react";
import { scopeTasks } from "@/components/project/toolbar/scope-tasks";
import type { ProjectWithTasks } from "@/types/project";
import { toPluginTask } from "./to-plugin-task";

type PluginLayoutTasksInput = {
  project: ProjectWithTasks | null | undefined;
  filteredProject: ProjectWithTasks | null | undefined;
  scope: ProjectViewScope;
  isLoading: boolean;
  error: Error | null;
};

export function usePluginLayoutTasks({
  project,
  filteredProject,
  scope,
  isLoading,
  error,
}: PluginLayoutTasksInput): ProjectViewState {
  const allTasks = useMemo(
    () => scopeTasks(project, scope).map(toPluginTask),
    [project, scope],
  );
  const tasks = useMemo(
    () => scopeTasks(filteredProject, scope).map(toPluginTask),
    [filteredProject, scope],
  );
  return useMemo(
    () => ({ tasks, allTasks, isLoading, error }),
    [tasks, allTasks, isLoading, error],
  );
}
