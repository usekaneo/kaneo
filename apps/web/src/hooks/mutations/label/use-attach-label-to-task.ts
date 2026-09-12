import { useMutation, useQueryClient } from "@tanstack/react-query";
import attachLabelToTask from "@/fetchers/label/attach-label-to-task";
import { addLabelToTaskInTasksCache } from "./sync-task-labels-cache";

export default function useAttachLabelToTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: attachLabelToTask,
    onSuccess: (attachedLabel) => {
      if (!attachedLabel.taskId) return;

      if (attachedLabel.workspaceId) {
        queryClient.setQueryData(
          ["labels", attachedLabel.workspaceId],
          (existingLabels: Array<typeof attachedLabel> | undefined) => {
            if (!existingLabels) return [attachedLabel];
            if (existingLabels.some((label) => label.id === attachedLabel.id)) {
              return existingLabels;
            }
            return [...existingLabels, attachedLabel];
          },
        );
      }

      queryClient.setQueryData(
        ["labels", attachedLabel.taskId],
        (existingLabels: Array<typeof attachedLabel> | undefined) => {
          if (!existingLabels) return [attachedLabel];
          if (existingLabels.some((label) => label.id === attachedLabel.id)) {
            return existingLabels;
          }
          return [...existingLabels, attachedLabel];
        },
      );

      addLabelToTaskInTasksCache(queryClient, attachedLabel.taskId, {
        id: attachedLabel.id,
        name: attachedLabel.name,
        color: attachedLabel.color,
      });

      void queryClient.invalidateQueries({
        queryKey: ["labels", attachedLabel.taskId],
      });

      if (attachedLabel.workspaceId) {
        void queryClient.invalidateQueries({
          queryKey: ["labels", attachedLabel.workspaceId],
        });
      }
    },
  });
}
