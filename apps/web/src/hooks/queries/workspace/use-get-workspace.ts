import getWorkspace from '@/fetchers/workspace/get-workspace';
import { useQuery } from '@tanstack/react-query';

function useGetWorkspace({ workspaceId }: { workspaceId: string }) {
  return useQuery({
    queryKey: [`workspace-${workspaceId}`],
    enabled: !!workspaceId,
    queryFn: () => getWorkspace({ workspaceId }),
  });
}

export default useGetWorkspace;
