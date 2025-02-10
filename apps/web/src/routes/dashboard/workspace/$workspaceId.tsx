import useGetWorkspace from '@/hooks/queries/workspace/use-get-workspace';
import useWorkspaceStore from '@/store/workspace';
import { Outlet, createFileRoute } from '@tanstack/react-router';
import { useEffect } from 'react';

const RouteComponent = () => {
  const { workspaceId } = Route.useParams();
  const { setWorkspace } = useWorkspaceStore();
  const { data } = useGetWorkspace({ workspaceId });

  useEffect(() => {
    if (data) {
      setWorkspace(data);
    }
  }, [data, setWorkspace]);

  return <Outlet />;
};

export const Route = createFileRoute('/dashboard/workspace/$workspaceId')({
  component: RouteComponent,
});
