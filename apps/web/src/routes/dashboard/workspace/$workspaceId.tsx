import useGetWorkspace from "@/hooks/queries/workspace/use-get-workspace";
import useWorkspaceStore from "@/store/workspace";
import { Outlet, createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/dashboard/workspace/$workspaceId")({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  const { data: workspace } = useGetWorkspace({ id: workspaceId });
  const { setWorkspace } = useWorkspaceStore();

  useEffect(() => {
    if (workspace) {
      setWorkspace(workspace);
    }
  }, [workspace, setWorkspace]);

  return <Outlet />;
}
