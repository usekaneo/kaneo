import SelectProjectState from "@/components/project/select-project-state";
import EmptyWorkspaceState from "@/components/workspace/empty-state";
import useGetWorkspace from "@/hooks/queries/workspace/use-get-workspace";
import useGetWorkspaces from "@/hooks/queries/workspace/use-get-workspaces";
import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { LayoutGrid } from "lucide-react";
import { useEffect } from "react";

export const Route = createFileRoute("/dashboard/workspace/$workspaceId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const { data, isLoading } = useGetWorkspace({ workspaceId });
  const { workspace, setWorkspace } = useWorkspaceStore();
  const { project } = useProjectStore();
  const { data: workspaces } = useGetWorkspaces();

  useEffect(() => {
    if (data) {
      setWorkspace(data);
    }
  }, [data, setWorkspace]);

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center h-screen flex-col md:flex-row bg-zinc-50 dark:bg-zinc-950">
        <div className="p-1.5 bg-linear-to-br from-indigo-500 to-purple-500 rounded-lg shadow-xs animate-spin">
          <LayoutGrid className="w-5 h-5 text-white" />
        </div>
      </div>
    );
  }

  if (workspaces && workspaces.length === 0) {
    return <EmptyWorkspaceState />;
  }

  if (workspace && !project) {
    return <SelectProjectState />;
  }

  return <Outlet />;
}
