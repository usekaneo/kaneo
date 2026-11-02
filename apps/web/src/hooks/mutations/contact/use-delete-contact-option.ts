import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ContactOptionKind,
  deleteContactOption,
} from "@/fetchers/contact-options";
import { invalidateContactOptions } from "@/hooks/queries/contact/use-contact-options";

export function useDeleteContactOption(
  workspaceId: string,
  kind: ContactOptionKind,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (key: string) => deleteContactOption(workspaceId, kind, key),
    onSuccess: () => invalidateContactOptions(queryClient, workspaceId),
  });
}
