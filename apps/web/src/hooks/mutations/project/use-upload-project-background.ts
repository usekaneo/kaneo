import { useMutation, useQueryClient } from "@tanstack/react-query";
import { uploadProjectBackground } from "@/fetchers/project/background";

type UploadProjectBackgroundVariables = {
  projectId: string;
  file: File;
};

function useUploadProjectBackground() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ projectId, file }: UploadProjectBackgroundVariables) =>
      uploadProjectBackground(projectId, file),
    onSuccess: async (_data, { projectId }) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["tasks", projectId] }),
        queryClient.invalidateQueries({ queryKey: ["projects"] }),
      ]);
    },
  });
}

export default useUploadProjectBackground;
