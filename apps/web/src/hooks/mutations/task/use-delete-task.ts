import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteTask from "@/fetchers/task/delete-task";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { removeTaskFromProject } from "./remove-task-from-project";

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTask,
    onSuccess: (deletedTask) => {
      queryClient.setQueryData<ProjectWithTasks | undefined>(
        ["tasks", deletedTask.projectId],
        (project) =>
          project ? removeTaskFromProject(project, deletedTask.id) : project,
      );
      queryClient.removeQueries({
        queryKey: ["task", deletedTask.id],
        exact: true,
      });
      void queryClient.invalidateQueries({
        queryKey: ["tasks", deletedTask.projectId],
      });

      const { project, setProject } = useProjectStore.getState();
      if (project?.id === deletedTask.projectId) {
        setProject(removeTaskFromProject(project, deletedTask.id));
      }
    },
  });
}
