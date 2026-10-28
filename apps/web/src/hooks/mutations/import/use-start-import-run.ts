import { useMutation, useQueryClient } from "@tanstack/react-query";
import startImportRun, {
  type StartImportRunRequest,
} from "@/fetchers/import/start-import-run";

function useStartImportRun() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StartImportRunRequest) => startImportRun(data),
    gcTime: 0,
    onSuccess: ({ run }) => {
      queryClient.setQueryData(["import-run", run.workspaceId, run.id], {
        run,
      });
      queryClient.invalidateQueries({
        queryKey: ["import-runs", run.workspaceId],
      });
    },
  });
}

export default useStartImportRun;
