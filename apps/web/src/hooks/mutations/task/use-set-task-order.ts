import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { PersonTask } from "@/fetchers/people/get-person-tasks";
import setTaskOrder from "@/fetchers/people/set-task-order";

/** Saves the person's own My work order; the list reorders immediately. */
function useSetTaskOrder(workspaceId: string, userId: string) {
  const queryClient = useQueryClient();
  const listKey = ["people", workspaceId, userId, "tasks"];

  return useMutation({
    mutationFn: (taskIds: string[]) =>
      setTaskOrder(workspaceId, userId, taskIds),
    onMutate: async (taskIds) => {
      await queryClient.cancelQueries({ queryKey: listKey });
      const previous = queryClient.getQueryData<PersonTask[]>(listKey);
      const position = new Map(taskIds.map((id, index) => [id, index]));
      queryClient.setQueryData<PersonTask[]>(listKey, (tasks) =>
        tasks?.map((task) => ({
          ...task,
          myPosition: position.get(task.id) ?? null,
        })),
      );
      return { previous };
    },
    onError: (_error, _ids, context) => {
      if (context?.previous)
        queryClient.setQueryData(listKey, context.previous);
    },
  });
}

export default useSetTaskOrder;
