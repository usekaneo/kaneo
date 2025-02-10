import KanbanBoard from '@/components/kanban-board';
import useGetProject from '@/hooks/queries/project/use-get-project';
import useProjectStore from '@/store/project';
import { createFileRoute } from '@tanstack/react-router';
import { LayoutGrid } from 'lucide-react';
import { useEffect } from 'react';

const RouteComponent = () => {
  const { workspaceId, projectId } = Route.useParams();
  const { data, isFetching } = useGetProject({ id: projectId, workspaceId });
  const { setProject } = useProjectStore();

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  if (isFetching) {
    return (
      <div className="flex w-full items-center justify-center h-screen flex-col md:flex-row bg-zinc-50 dark:bg-zinc-950">
        <div className="p-1.5 bg-linear-to-br from-indigo-500 to-purple-500 rounded-lg shadow-xs animate-spin">
          <LayoutGrid className="w-5 h-5 text-white" />
        </div>
      </div>
    );
  }

  return <KanbanBoard />;
};

export const Route = createFileRoute(
  '/dashboard/workspace/$workspaceId/project/$projectId',
)({
  component: RouteComponent,
});
