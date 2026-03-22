import { useMutation, useQueryClient } from "@tanstack/react-query";
import createLabel from "@/fetchers/label/create-label";
import type { CreateLabelRequest } from "@/fetchers/label/create-label";

function useCreateLabel() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createLabel,
    onSuccess: (createdLabel, variables: CreateLabelRequest) => {
      queryClient.setQueryData(
        ["labels", variables.workspaceId],
        (existingLabels: Array<typeof createdLabel> | undefined) => {
          if (!existingLabels) return [createdLabel];

          const alreadyExists = existingLabels.some(
            (label) => label.id === createdLabel.id,
          );

          return alreadyExists
            ? existingLabels
            : [...existingLabels, createdLabel];
        },
      );

      if (createdLabel.taskId) {
        queryClient.setQueryData(
          ["labels", createdLabel.taskId],
          (existingLabels: Array<typeof createdLabel> | undefined) => {
            if (!existingLabels) return [createdLabel];

            const alreadyExists = existingLabels.some(
              (label) => label.id === createdLabel.id,
            );

            return alreadyExists
              ? existingLabels
              : [...existingLabels, createdLabel];
          },
        );
      }

      void queryClient.invalidateQueries({
        queryKey: ["labels", variables.workspaceId],
      });

      if (createdLabel.taskId) {
        void queryClient.invalidateQueries({
          queryKey: ["labels", createdLabel.taskId],
        });
      }
    },
  });
}

export default useCreateLabel;
