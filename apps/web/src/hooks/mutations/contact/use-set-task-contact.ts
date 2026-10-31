import { useMutation, useQueryClient } from "@tanstack/react-query";
import { setTaskContact } from "@/fetchers/contact";
import { contactsQueryKey } from "@/hooks/queries/contact/use-contacts";

export function useSetTaskContact(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      taskId,
      contactId,
    }: {
      taskId: string;
      contactId: string | null;
    }) => setTaskContact(taskId, contactId),
    onSuccess: (_, { taskId }) => {
      queryClient.invalidateQueries({ queryKey: ["task", taskId] });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({
        queryKey: contactsQueryKey(workspaceId),
      });
    },
  });
}
