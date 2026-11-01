import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { type ContactFilters, listContacts } from "@/fetchers/contact";

export const contactsQueryKey = (workspaceId: string) => [
  "contacts",
  workspaceId,
];

export function useContacts(workspaceId: string, filters: ContactFilters = {}) {
  return useQuery({
    queryKey: [...contactsQueryKey(workspaceId), filters],
    queryFn: () => listContacts(workspaceId, filters),
    enabled: Boolean(workspaceId),
    placeholderData: keepPreviousData,
  });
}
