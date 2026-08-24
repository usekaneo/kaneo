import { useMutation, useQueryClient } from "@tanstack/react-query";
import { removeProjectBackground } from "@/fetchers/project/background";

function useRemoveProjectBackground() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeProjectBackground,
    onSuccess: async (_data, projectId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    },
  });
}

export default useRemoveProjectBackground;
