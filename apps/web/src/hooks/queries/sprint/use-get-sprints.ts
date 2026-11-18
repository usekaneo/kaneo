import { useQuery } from "@tanstack/react-query";
import getSprints from "@/fetchers/sprint/get-sprints";

export function useGetSprints(projectId: string) {
  return useQuery({
    queryKey: ["sprints", projectId],
    queryFn: () => getSprints(projectId),
    enabled: !!projectId,
  });
}
