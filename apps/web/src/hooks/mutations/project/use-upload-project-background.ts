import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { uploadProjectBackground } from "@/fetchers/project/background";
import { toast } from "@/lib/toast";

type UploadProjectBackgroundVariables = {
  projectId: string;
  file: File;
};

function useUploadProjectBackground() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, file }: UploadProjectBackgroundVariables) =>
      uploadProjectBackground(projectId, file),
    onSuccess: async (_data, { projectId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
      toast.success(t("settings:projectGeneral.backgroundUploadSuccess"));
    },
    onError: () => {
      toast.error(t("settings:projectGeneral.backgroundUploadError"));
    },
  });
}

export default useUploadProjectBackground;
