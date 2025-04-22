import importTasks, { type TaskToImport } from "@/fetchers/task/import-tasks";
import { useMutation } from "@tanstack/react-query";

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
