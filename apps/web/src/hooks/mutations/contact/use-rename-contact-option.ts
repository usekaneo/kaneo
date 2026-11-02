import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  type ContactOptionKind,
  renameContactOption,
} from "@/fetchers/contact-options";
import { invalidateContactOptions } from "@/hooks/queries/contact/use-contact-options";

export function useRenameContactOption(
  workspaceId: string,
  kind: ContactOptionKind,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ key, label }: { key: string; label: string }) =>
      renameContactOption(workspaceId, kind, key, label),
    onSuccess: () => invalidateContactOptions(queryClient, workspaceId),
  });
}
