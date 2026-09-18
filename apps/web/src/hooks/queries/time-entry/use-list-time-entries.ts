import { keepPreviousData, useQuery } from "@tanstack/react-query";
import listTimeEntries, {
  type ListTimeEntriesRequest,
} from "@/fetchers/time-entry/list-time-entries";

function useListTimeEntries(query: ListTimeEntriesRequest | null) {
  return useQuery({
    queryKey: ["time-entries", "list", query],
    queryFn: () => listTimeEntries(query as ListTimeEntriesRequest),
    enabled: !!query?.workspaceId,
    // Keeps last week's grid on screen while the next week loads.
    placeholderData: keepPreviousData,
  });
}

export default useListTimeEntries;
