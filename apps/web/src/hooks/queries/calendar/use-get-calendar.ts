import { useQuery } from "@tanstack/react-query";
import getCalendar from "@/fetchers/calendar/get-calendar";

function useGetCalendar(workspaceId: string | undefined) {
  return useQuery({
    enabled: Boolean(workspaceId),
    queryKey: ["calendar", workspaceId],
    queryFn: () => getCalendar(workspaceId as string),
  });
}

export default useGetCalendar;
