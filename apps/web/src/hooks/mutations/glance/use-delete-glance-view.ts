import { useMutation, useQueryClient } from "@tanstack/react-query";
import { deleteGlanceView } from "@/fetchers/glance/delete-glance-view";
import type { GlancePrefs } from "@/fetchers/glance/types";

export function useDeleteGlanceView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (viewId: string) => deleteGlanceView(viewId),
    onSuccess: (updated) => {
      queryClient.setQueryData<GlancePrefs>(["glance-prefs"], updated);
    },
    onError: (error) => {
      console.error("[Glance] Failed to delete view:", error);
    },
  });
}
