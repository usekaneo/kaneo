import { useQuery } from "@tanstack/react-query";
import { getGlanceMembers } from "@/fetchers/glance/get-glance-members";

export function useGlanceMembers(enabled: boolean) {
  return useQuery({
    queryKey: ["glance-members"],
    queryFn: getGlanceMembers,
    enabled,
    staleTime: 5 * 60 * 1000,
  });
}
