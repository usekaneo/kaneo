import clearNotifications from "@/fetchers/notification/clear-notifications";
import { useMutation, useQueryClient } from "@tanstack/react-query";

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
