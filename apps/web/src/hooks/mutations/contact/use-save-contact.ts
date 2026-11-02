import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ContactFields,
  createContact,
  updateContact,
} from "@/fetchers/contact";
import { contactOptionsQueryKey } from "@/hooks/queries/contact/use-contact-options";
import { contactsQueryKey } from "@/hooks/queries/contact/use-contacts";

export function useSaveContact(workspaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, fields }: { id?: string; fields: ContactFields }) =>
      id
        ? updateContact(workspaceId, id, fields)
        : createContact(workspaceId, fields),
    // Option counts in settings depend on which contacts use each option.
    onSuccess: () =>
      Promise.all([
        queryClient.invalidateQueries({
          queryKey: contactsQueryKey(workspaceId),
        }),
        queryClient.invalidateQueries({
          queryKey: contactOptionsQueryKey(workspaceId),
        }),
      ]),
  });
}
