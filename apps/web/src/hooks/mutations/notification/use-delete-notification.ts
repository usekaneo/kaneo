import { useMutation, useQueryClient } from "@tanstack/react-query";
import deleteNotification from "@/fetchers/notification/delete-notification";

function useDeleteNotification() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => deleteNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
}

export default useDeleteNotification;
