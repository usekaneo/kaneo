import markNotificationAsRead from "@/fetchers/notification/mark-notification-as-read";
import { useMutation, useQueryClient } from "@tanstack/react-query";

function useMarkNotificationAsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => markNotificationAsRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export default useMarkNotificationAsRead;
