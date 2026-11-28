import { useMutation, useQueryClient } from "@tanstack/react-query";
import archiveProject from "@/fetchers/project/archive-project";

function useArchiveProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: archiveProject,
    onSuccess: ({ workspaceId }) => {
      void queryClient.invalidateQueries({
        queryKey: ["assigned-tasks", workspaceId],
      });
    },
  });
}

export default useArchiveProject;
