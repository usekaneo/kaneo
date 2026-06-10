import { useQuery } from "@tanstack/react-query";
import { getGlancePrefs } from "@/fetchers/glance/get-glance-prefs";

export function useGlancePrefs(enabled: boolean) {
  return useQuery({
    queryKey: ["glance-prefs"],
    queryFn: getGlancePrefs,
    enabled,
  });
}
