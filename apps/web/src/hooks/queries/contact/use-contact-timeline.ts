import { useQuery } from "@tanstack/react-query";
import { getContactTimeline } from "@/fetchers/contact";

export const contactTimelineQueryKey = (workspaceId: string, id: string) => [
  "contacts",
  workspaceId,
  "timeline",
  id,
];

export function useContactTimeline(workspaceId: string, id: string | null) {
  return useQuery({
    queryKey: contactTimelineQueryKey(workspaceId, id ?? ""),
    queryFn: () => getContactTimeline(workspaceId, id as string),
    enabled: Boolean(workspaceId && id),
  });
}
