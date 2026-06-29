import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createGlanceView } from "@/fetchers/glance/create-glance-view";
import type { GlanceFilterState, GlancePrefs } from "@/fetchers/glance/types";

export function useCreateGlanceView() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ name, state }: { name: string; state: GlanceFilterState }) =>
      createGlanceView(name, state),
    onSuccess: (updated) => {
      queryClient.setQueryData<GlancePrefs>(["glance-prefs"], updated);
    },
  });
}
