import { useMutation, useQueryClient } from "@tanstack/react-query";
import createProject from "@/fetchers/project/create-project";

function useCreateProject() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: createProject,
    onSuccess: (_, { workspaceId }) =>
      Promise.all([
        queryClient.invalidateQueries({ queryKey: ["projects", workspaceId] }),
        queryClient.invalidateQueries({
          queryKey: ["project-templates", workspaceId],
        }),
      ]),
  });
}

export default useCreateProject;
