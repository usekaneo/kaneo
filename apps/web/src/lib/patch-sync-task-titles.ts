import type { QueryClient } from "@tanstack/react-query";
import type { SyncPreview } from "@/fetchers/integration-sync/types";

export function patchSyncTaskTitles(
  client: QueryClient,
  projectId: string,
  taskId: string,
  title: string,
) {
  for (const prefix of ["integration-sync", "integration-sync-preview"])
    client.setQueriesData<SyncPreview>(
      { queryKey: [prefix, projectId] },
      (current) => {
        if (!current) return current;
        if (
          ![...current.matchingTasks, ...current.pausedTasks].some(
            (task) => task.id === taskId && task.title !== title,
          )
        )
          return current;
        const patch = <T extends { id: string; title: string }>(tasks: T[]) =>
          tasks.map((task) => (task.id === taskId ? { ...task, title } : task));
        return {
          ...current,
          matchingTasks: patch(current.matchingTasks),
          pausedTasks: patch(current.pausedTasks),
        };
      },
    );
}

export function hasSyncTaskSample(
  client: QueryClient,
  projectId: string,
  taskId: string,
) {
  return ["integration-sync", "integration-sync-preview"].some((prefix) =>
    client
      .getQueriesData<SyncPreview>({ queryKey: [prefix, projectId] })
      .some(
        ([, data]) =>
          data &&
          [...data.matchingTasks, ...data.pausedTasks].some(
            (task) => task.id === taskId,
          ),
      ),
  );
}
