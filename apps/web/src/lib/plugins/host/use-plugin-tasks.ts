import type { PluginTask, QueryState } from "@kaneo/plugin-sdk/web";
import { useMemo } from "react";
import useGetTask from "@/hooks/queries/task/use-get-task";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { flattenBoardTasks, toPluginTask } from "./to-plugin-task";

export function usePluginTask(taskId: string): QueryState<PluginTask> {
  const { data, isLoading, error } = useGetTask(taskId);
  const task = useMemo(() => (data ? toPluginTask(data) : undefined), [data]);
  return { data: task, isLoading, error };
}

export function usePluginTasks(projectId: string): QueryState<PluginTask[]> {
  const { data, isLoading, error } = useGetTasks(projectId);
  const tasks = useMemo(
    () => (data ? flattenBoardTasks(data) : undefined),
    [data],
  );
  return { data: tasks, isLoading, error };
}
