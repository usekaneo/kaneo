import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ContactFields,
  createContact,
  updateContact,
} from "@/fetchers/contact";
import { contactsQueryKey } from "@/hooks/queries/contact/use-contacts";

export function useSaveContact(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: ContactFields }) =>
      id
        ? updateContact(workspaceId, id, fields)
        : createContact(workspaceId, fields),
    onSuccess: () =>
      queryClient.invalidateQueries({
        queryKey: contactsQueryKey(workspaceId),
      }),
  });
}
