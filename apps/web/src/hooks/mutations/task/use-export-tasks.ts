import exportTasks from "@/fetchers/task/export-tasks";
import { useMutation } from "@tanstack/react-query";

const useExportTasks = () => {
  return useMutation({
    mutationFn: (projectId: string) => exportTasks(projectId),
  });
};

export default useExportTasks;
