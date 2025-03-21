import updateProject from "@/fetchers/project/update-project";
import { useMutation } from "@tanstack/react-query";

function useUpdateProject() {
  return useMutation({
    mutationFn: updateProject,
  });
}

export default useUpdateProject;
