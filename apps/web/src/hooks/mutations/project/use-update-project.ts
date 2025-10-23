import { useMutation } from "@tanstack/react-query";
import updateProject from "@/fetchers/project/update-project";

function useUpdateProject() {
  return useMutation({
    mutationFn: updateProject,
  });
}

export default useUpdateProject;
