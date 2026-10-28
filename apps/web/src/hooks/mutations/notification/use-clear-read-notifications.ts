import { useMutation, useQueryClient } from "@tanstack/react-query";
import clearReadNotifications from "@/fetchers/notification/clear-read-notifications";

function useClearReadNotifications(workspaceId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => clearReadNotifications(workspaceId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export default useClearReadNotifications;
