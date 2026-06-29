import { useQuery } from "@tanstack/react-query";
import { getGlanceFilters } from "@/fetchers/glance/get-glance-filters";

export function useGlanceFilters(enabled: boolean) {
  return useQuery({
    queryKey: ["glance-filters"],
    queryFn: getGlanceFilters,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
