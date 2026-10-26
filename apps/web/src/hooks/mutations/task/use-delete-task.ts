import { useMutation, useQueryClient } from "@tanstack/react-query";
import { invalidateMyWork } from "@/lib/invalidate-my-work";
import deleteTask from "@/fetchers/task/delete-task";
import useProjectStore from "@/store/project";
import type { ProjectWithTasks } from "@/types/project";
import { removeTaskFromProject } from "./remove-task-from-project";
import { removeTasksFromRelations } from "./remove-task-from-relations";

export function useDeleteTask() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: deleteTask,
    onSuccess: (deletedTask) => {
      invalidateMyWork(queryClient);
      void queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.setQueryData<ProjectWithTasks | undefined>(
        ["tasks", deletedTask.projectId],
        (project) =>
          project ? removeTaskFromProject(project, deletedTask.id) : project,
      );
      queryClient.removeQueries({
        queryKey: ["task", deletedTask.id],
        exact: true,
      });
      removeTasksFromRelations(queryClient, [deletedTask.id]);
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
