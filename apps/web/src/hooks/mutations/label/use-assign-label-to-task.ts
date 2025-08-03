import { useMutation } from "@tanstack/react-query";
import assignLabelToTask from "../../../fetchers/label/assign-label-to-task";

function useAssignLabelToTask() {
  return useMutation({
    mutationFn: assignLabelToTask,
  });
}

export default useAssignLabelToTask;
