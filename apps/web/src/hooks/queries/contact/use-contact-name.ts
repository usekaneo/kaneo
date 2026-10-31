import { useQuery } from "@tanstack/react-query";
import { listContacts } from "@/fetchers/contact";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { contactsQueryKey } from "./use-contacts";

// Shares the unfiltered contacts query, so a board of leads costs one request.
export function useContactName(contactId: string) {
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";

  const { data } = useQuery({
    queryKey: [...contactsQueryKey(workspaceId), {}],
    queryFn: () => listContacts(workspaceId, {}),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
    select: (contacts) =>
      contacts.find((contact) => contact.id === contactId)?.name ?? null,
  });

  return data ?? null;
}
