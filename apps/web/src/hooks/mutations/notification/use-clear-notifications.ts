import { useMutation, useQueryClient } from "@tanstack/react-query";
import clearNotifications from "@/fetchers/notification/clear-notifications";

function useClearNotifications() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: clearNotifications,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export default useClearNotifications;
