import type { TaskChanges } from "@kaneo/plugin-sdk/web";
import { useCallback } from "react";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";

export function usePluginUpdateTask(): (
  taskId: string,
  changes: TaskChanges,
) => Promise<void> {
  const { mutateAsync } = useUpdateTask();

  return useCallback(
    async (taskId: string, changes: TaskChanges) => {
      if (Object.values(changes).every((value) => value === undefined)) return;
      await mutateAsync({ taskId, changes });
    },
    [mutateAsync],
  );
}
