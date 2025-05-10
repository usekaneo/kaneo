import markAllNotificationsAsRead from "@/fetchers/notification/mark-all-notifications-as-read";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useMarkAllNotificationsAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: markAllNotificationsAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export default useMarkAllNotificationsAsRead;
