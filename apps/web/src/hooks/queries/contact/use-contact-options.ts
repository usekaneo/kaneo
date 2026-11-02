import { type QueryClient, useQuery } from "@tanstack/react-query";
import { listContactOptions } from "@/fetchers/contact-options";
import { contactsQueryKey } from "./use-contacts";

export const contactOptionsQueryKey = (workspaceId: string) => [
  "contact-options",
  workspaceId,
];

export function useContactOptions(workspaceId: string) {
  return useQuery({
    queryKey: contactOptionsQueryKey(workspaceId),
    queryFn: () => listContactOptions(workspaceId),
    enabled: Boolean(workspaceId),
    staleTime: 60_000,
  });
}

// Options feed the labels in the contact list, so refresh both.
export function invalidateContactOptions(
  queryClient: QueryClient,
  workspaceId: string,
) {
  return Promise.all([
    queryClient.invalidateQueries({
      queryKey: contactOptionsQueryKey(workspaceId),
    }),
    queryClient.invalidateQueries({ queryKey: contactsQueryKey(workspaceId) }),
  ]);
}
