import { useQuery } from "@tanstack/react-query";
import globalSearch from "@/fetchers/search/global-search";

type SearchParams = {
  q: string;
  type?:
    | "all"
    | "tasks"
    | "projects"
    | "workspaces"
    | "comments"
    | "activities";
  workspaceId?: string;
  projectId?: string;
  limit?: number;
};

function useGlobalSearch(params: SearchParams) {
  return useQuery({
    queryKey: ["search", params],
    queryFn: () => globalSearch(params),
    enabled: !!params.q && params.q.length > 2,
    staleTime: 1000 * 30, // 30 seconds
  });
}

export default useGlobalSearch;
