import { useQuery } from "@tanstack/react-query";
import listPeople from "@/fetchers/people/list-people";

function usePeople(workspaceId: string | undefined) {
  return useQuery({
    queryKey: ["people", workspaceId],
    queryFn: () => listPeople(workspaceId as string),
    enabled: !!workspaceId,
  });
}

export default usePeople;
