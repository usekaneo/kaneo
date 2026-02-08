import { createFileRoute } from "@tanstack/react-router";
import PageTitle from "@/components/page-title";
import ColumnEditor from "@/components/project/column-editor";
import WorkflowEditor from "@/components/project/workflow-editor";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/workflow",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();

  return (
    <>
      <PageTitle title="Workflow Settings" />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Workflow</h1>
          <p className="text-muted-foreground">
            Configure board columns and automation rules for this project.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">Columns</h2>
            <p className="text-xs text-muted-foreground">
              Manage the columns that appear on your board. Drag to reorder.
              Turn on "Done column" for stages that represent completed work.
            </p>
          </div>
          <ColumnEditor projectId={projectId} />
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">Automation Rules</h2>
            <p className="text-xs text-muted-foreground">
              Map integration events to columns. When an event occurs, the
              linked task moves to the specified column.
            </p>
          </div>
          <WorkflowEditor projectId={projectId} />
        </div>
      </div>
    </>
  );
}
