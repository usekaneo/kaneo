import { useQuery } from "@tanstack/react-query";
import getProjectTemplates from "@/fetchers/project/get-project-templates";

function useGetProjectTemplates({
  workspaceId,
  enabled = true,
}: {
  workspaceId: string;
  enabled?: boolean;
}) {
  return useQuery({
    queryFn: () => getProjectTemplates({ workspaceId }),
    queryKey: ["project-templates", workspaceId],
    enabled: enabled && !!workspaceId,
  });
}

export default useGetProjectTemplates;
