import { useQuery } from "@tanstack/react-query";
import getPeopleOverview from "@/fetchers/people/get-people-overview";

function usePeopleOverview(workspaceId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["people", workspaceId, "overview"],
    queryFn: () => getPeopleOverview(workspaceId),
    enabled: !!workspaceId && enabled,
  });
}

export default usePeopleOverview;
