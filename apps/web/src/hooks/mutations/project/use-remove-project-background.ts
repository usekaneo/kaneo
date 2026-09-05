import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { removeProjectBackground } from "@/fetchers/project/background";
import { toast } from "@/lib/toast";

function useRemoveProjectBackground() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: removeProjectBackground,
    onSuccess: async (_data, projectId) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      toast.success(t("settings:projectGeneral.backgroundRemoveSuccess"));
    },
    onError: () => {
      toast.error(t("settings:projectGeneral.backgroundRemoveError"));
    },
  });
}

export default useRemoveProjectBackground;
