import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { GlancePrefs } from "@/fetchers/glance/types";
import { updateGlancePrefs } from "@/fetchers/glance/update-glance-prefs";

export function useUpdateGlancePrefs() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: updateGlancePrefs,
    onSuccess: (updated) => {
      queryClient.setQueryData<GlancePrefs>(["glance-prefs"], updated);
    },
  });
}
