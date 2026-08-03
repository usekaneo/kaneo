import { useMutation, useQueryClient } from "@tanstack/react-query";
import upsertSavedView from "@/fetchers/saved-view/upsert-saved-view";

function useUpsertSavedView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: upsertSavedView,
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["saved-views"] }),
  });
}

export default useUpsertSavedView;
