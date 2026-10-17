import { useMutation, useQueryClient } from "@tanstack/react-query";
import markNotificationAsUnread from "@/fetchers/notification/mark-notification-as-unread";

function useMarkNotificationAsUnread() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationAsUnread(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export default useMarkNotificationAsUnread;
