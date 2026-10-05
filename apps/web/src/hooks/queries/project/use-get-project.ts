import { useQuery } from "@tanstack/react-query";
import getProject from "@/fetchers/project/get-project";
import { isUnauthorizedError } from "@/lib/http-error";
import { getProjectUnavailableReason } from "@/lib/project-unavailable-reason";

function useGetProject({
  id,
  workspaceId,
}: {
  id: string;
  workspaceId: string;
}) {
  return useQuery({
    queryFn: () => getProject({ id, workspaceId }),
    queryKey: ["projects", workspaceId, id],
    enabled: !!id,
    retry: (failureCount, error) =>
      !isUnauthorizedError(error) &&
      !getProjectUnavailableReason(error) &&
      failureCount < 2,
  });
}

export default useGetProject;
