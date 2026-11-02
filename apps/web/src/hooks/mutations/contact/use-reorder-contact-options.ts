import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ContactOptionKind,
  reorderContactOptions,
} from "@/fetchers/contact-options";
import { contactOptionsQueryKey } from "@/hooks/queries/contact/use-contact-options";

export function useReorderContactOptions(
  workspaceId: string,
  kind: ContactOptionKind,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (keys: string[]) =>
      reorderContactOptions(workspaceId, kind, keys),
    // The response is the full, re-ordered list.
    onSuccess: (options) =>
      queryClient.setQueryData(contactOptionsQueryKey(workspaceId), options),
  });
}
