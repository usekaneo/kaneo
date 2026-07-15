import { useQuery } from "@tanstack/react-query";
import { getGlanceTasks } from "@/fetchers/glance/get-glance-tasks";

export function useGlanceTasks(
  filters: Record<string, string>,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ["glance-tasks", filters],
    queryFn: () => getGlanceTasks(filters),
    enabled,
  });
}
