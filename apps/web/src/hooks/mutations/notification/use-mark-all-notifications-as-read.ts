import { useMutation, useQueryClient } from "@tanstack/react-query";
import markAllNotificationsAsRead from "@/fetchers/notification/mark-all-notifications-as-read";

function useMarkAllNotificationsAsRead(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export default useMarkAllNotificationsAsRead;
