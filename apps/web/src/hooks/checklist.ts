import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { checklistApi } from "@/fetchers/checklist";

export const checklistKey = (taskId: string) =>
  ["task-checklists", taskId] as const;

export function useChecklists(taskId: string) {
  return useQuery({
    queryKey: checklistKey(taskId),
    queryFn: () => checklistApi.list(taskId),
    enabled: !!taskId,
  });
}

export function useChecklistActions(taskId: string) {
  const queryClient = useQueryClient();
  // Checklists and the subtask relations (their items) change together.
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: checklistKey(taskId) }),
      queryClient.invalidateQueries({ queryKey: ["task-relations", taskId] }),
    ]);

  return {
    create: useMutation({
      mutationFn: (title?: string) => checklistApi.create(taskId, title),
      onSuccess: refresh,
    }),
    rename: useMutation({
      mutationFn: ({ id, title }: { id: string; title: string }) =>
        checklistApi.rename(taskId, id, title),
      onSuccess: refresh,
    }),
    remove: useMutation({
      mutationFn: (id: string) => checklistApi.remove(taskId, id),
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["tasks"] });
        return refresh();
      },
    }),
    reorder: useMutation({
      mutationFn: (checklistIds: string[]) =>
        checklistApi.reorder(taskId, checklistIds),
      onSettled: refresh,
    }),
    setItems: useMutation({
      mutationFn: ({
        id,
        relationIds,
      }: {
        id: string;
        relationIds: string[];
      }) => checklistApi.setItems(taskId, id, relationIds),
      onSettled: refresh,
    }),
  };
}
