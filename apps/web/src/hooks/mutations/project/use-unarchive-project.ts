import { useMutation } from "@tanstack/react-query";
import unarchiveProject from "@/fetchers/project/unarchive-project";

function useUnarchiveProject() {
  return useMutation({
    mutationFn: unarchiveProject,
  });
}

export default useUnarchiveProject;
