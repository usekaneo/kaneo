import getProjects from '@/fetchers/project/get-projects';
import { useQuery } from '@tanstack/react-query';

function useGetProjects({ workspaceId }: { workspaceId: string }) {
  return useQuery({
    queryFn: () => getProjects({ workspaceId }),
    queryKey: ['projects', workspaceId],
    enabled: !!workspaceId,
  });
}

export default useGetProjects;
