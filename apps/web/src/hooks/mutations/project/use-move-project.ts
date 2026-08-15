import { useMutation, useQueryClient } from "@tanstack/react-query";
import moveProject from "@/fetchers/project/move-project";

function useMoveProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: moveProject,
    // `["projects"]` prefix-matches both the source and target listings.
    // `["tasks", id]` backs the project store, which still carries the old
    // workspace id that other views build links from.
    onSuccess: async (_data, { id }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
        queryClient.invalidateQueries({ queryKey: ["tasks", id] }),
      ]);
    },
  });
}

export default useMoveProject;
