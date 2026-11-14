import { useMutation } from "@tanstack/react-query";
import archiveProject from "@/fetchers/project/archive-project";

function useArchiveProject() {
  return useMutation({
    mutationFn: archiveProject,
  });
}

export default useArchiveProject;
