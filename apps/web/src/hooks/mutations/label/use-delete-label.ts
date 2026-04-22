import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteLabel from "@/fetchers/label/delete-label";
import { removeLabelFromTaskInTasksCache } from "./sync-task-labels-cache";

function useDeleteLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteLabel,
    onSuccess: (deletedLabel) => {
      queryClient.setQueryData(
        ["labels", deletedLabel.workspaceId],
        (existingLabels: Array<typeof deletedLabel> | undefined) =>
          existingLabels?.filter((label) => label.id !== deletedLabel.id) ?? [],
      );

      if (deletedLabel.taskId) {
        queryClient.setQueryData(
          ["labels", deletedLabel.taskId],
          (existingLabels: Array<typeof deletedLabel> | undefined) =>
            existingLabels?.filter((label) => label.id !== deletedLabel.id) ??
            [],
        );

        removeLabelFromTaskInTasksCache(
          queryClient,
          deletedLabel.taskId,
          deletedLabel.id,
        );
      }

      void queryClient.invalidateQueries({
        queryKey: ["labels", deletedLabel.workspaceId],
      });

      if (deletedLabel.taskId) {
        void queryClient.invalidateQueries({
          queryKey: ["labels", deletedLabel.taskId],
        });
      }
    },
  });
}

export default useDeleteLabel;
