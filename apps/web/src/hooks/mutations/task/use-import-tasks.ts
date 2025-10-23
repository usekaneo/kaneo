import { useMutation } from "@tanstack/react-query";
import importTasks, { type TaskToImport } from "@/fetchers/task/import-tasks";

const useImportTasks = () => {
  return useMutation({
    mutationFn: ({
      projectId,
      tasks,
    }: {
      projectId: string;
      tasks: TaskToImport[];
    }) => importTasks(projectId, tasks),
  });
};

export default useImportTasks;
