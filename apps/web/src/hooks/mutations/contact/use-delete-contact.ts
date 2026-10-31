import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteContact } from "@/fetchers/contact";
import { contactsQueryKey } from "@/hooks/queries/contact/use-contacts";

export function useDeleteContact(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteContact(workspaceId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: contactsQueryKey(workspaceId),
      });
      // Deleting clears the link on every task that used the contact.
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["task"] });
    },
  });
}
