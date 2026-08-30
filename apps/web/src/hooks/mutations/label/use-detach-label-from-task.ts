import { useMutation, useQueryClient } from "@tanstack/react-query";
import detachLabelFromTask from "@/fetchers/label/detach-label-from-task";
import { removeLabelFromTaskInTasksCache } from "./sync-task-labels-cache";

export default function useDetachLabelFromTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: detachLabelFromTask,
    onSuccess: (detachedLabel) => {
      if (!detachedLabel.taskId) return;

      if (detachedLabel.workspaceId) {
        queryClient.setQueryData(
          ["labels", detachedLabel.workspaceId],
          (existingLabels: Array<typeof detachedLabel> | undefined) =>
            existingLabels?.filter((label) => label.id !== detachedLabel.id) ??
            [],
        );
      }

      queryClient.setQueryData(
        ["labels", detachedLabel.taskId],
        (existingLabels: Array<typeof detachedLabel> | undefined) =>
          existingLabels?.filter((label) => label.id !== detachedLabel.id) ??
          [],
      );

      removeLabelFromTaskInTasksCache(
        queryClient,
        detachedLabel.taskId,
        detachedLabel.id,
      );

      void queryClient.invalidateQueries({
        queryKey: ["labels", detachedLabel.taskId],
      });

      if (detachedLabel.workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: ["labels", detachedLabel.workspaceId],
        });
      }
    },
  });
}
