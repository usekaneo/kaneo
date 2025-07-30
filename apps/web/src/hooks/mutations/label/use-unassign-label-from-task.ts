import { useMutation } from "@tanstack/react-query";
import unassignLabelFromTask from "../../../fetchers/label/unassign-label-from-task";

function useUnassignLabelFromTask() {
  return useMutation({
    mutationFn: unassignLabelFromTask,
  });
}

export default useUnassignLabelFromTask;
