import { useMutation } from "@tanstack/react-query";
import exportTasks from "@/fetchers/task/export-tasks";

const useExportTasks = () => {
  return useMutation({
    mutationFn: (projectId: string) => exportTasks(projectId),
  });
};

export default useExportTasks;
