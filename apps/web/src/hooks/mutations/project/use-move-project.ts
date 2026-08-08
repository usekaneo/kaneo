import { useMutation } from "@tanstack/react-query";
import moveProject from "@/fetchers/project/move-project";

function useMoveProject() {
  return useMutation({
    mutationFn: moveProject,
  });
}

export default useMoveProject;
