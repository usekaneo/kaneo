import { useMutation, useQueryClient } from "@tanstack/react-query";
import clearNotifications from "@/fetchers/notification/clear-notifications";

function useClearNotifications(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearNotifications(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export default useClearNotifications;
