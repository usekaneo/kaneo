import deleteProject from "@/fetchers/project/delete-project";
import { useMutation } from "@tanstack/react-query";

function useDeleteProject() {
  return useMutation({
    mutationFn: deleteProject,
  });
}

export default useDeleteProject;
