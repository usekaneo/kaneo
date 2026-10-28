import { useQuery } from "@tanstack/react-query";
import { getCalendarFeeds } from "@/fetchers/calendar-feed";

export function calendarFeedsQueryKey(projectId: string) {
  return ["calendar-feeds", projectId];
}

export function useCalendarFeeds(projectId: string, enabled: boolean) {
  return useQuery({
    queryKey: calendarFeedsQueryKey(projectId),
    queryFn: () => getCalendarFeeds(projectId),
    enabled,
  });
}
