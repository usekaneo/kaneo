import { useQuery } from "@tanstack/react-query";
import getNotifications from "@/fetchers/notification/get-notifications";

function useGetNotifications(workspaceId?: string) {
  return useQuery({
    queryKey: ["notifications", workspaceId],
    queryFn: () => getNotifications(workspaceId),
    enabled: Boolean(workspaceId),
  });
}

export default useGetNotifications;
