import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  addContactOptions,
  type ContactOptionKind,
} from "@/fetchers/contact-options";
import { invalidateContactOptions } from "@/hooks/queries/contact/use-contact-options";

export function useAddContactOptions(
  workspaceId: string,
  kind: ContactOptionKind,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (labels: string[]) =>
      addContactOptions(workspaceId, kind, labels),
    // Settle, not success: a long paste may add some batches before one fails.
    onSettled: () => invalidateContactOptions(queryClient, workspaceId),
  });
}
