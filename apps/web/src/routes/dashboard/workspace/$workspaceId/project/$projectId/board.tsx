import KanbanBoard from "@/components/kanban-board";
import useGetProject from "@/hooks/queries/project/use-get-project";
import useProjectStore from "@/store/project";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute(
  "/dashboard/workspace/$workspaceId/project/$projectId/board",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, projectId } = Route.useParams();
  const { data } = useGetProject({ id: projectId, workspaceId });
  const { setProject } = useProjectStore();

  useEffect(() => {
    if (data) {
      setProject(data);
    }
  }, [data, setProject]);

  return (
    <div className="flex flex-1">
      <KanbanBoard />
    </div>
  );
}
