import type { TaskChanges } from "@kaneo/plugin-sdk/web";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import getTask from "@/fetchers/task/get-task";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import type Task from "@/types/task";
import { applyTaskChanges } from "./apply-task-changes";
import { findCachedTask } from "./find-cached-task";

export function usePluginUpdateTask(): (
  taskId: string,
  changes: TaskChanges,
) => Promise<void> {
  const queryClient = useQueryClient();
  const { mutateAsync } = useUpdateTask();

  return useCallback(
    async (taskId: string, changes: TaskChanges) => {
      const task =
        findCachedTask(queryClient, taskId) ??
        ((await queryClient.fetchQuery({
          queryKey: ["task", taskId],
          queryFn: () => getTask(taskId),
        })) as Task);
      await mutateAsync(applyTaskChanges(task, changes));
    },
    [mutateAsync, queryClient],
  );
}
