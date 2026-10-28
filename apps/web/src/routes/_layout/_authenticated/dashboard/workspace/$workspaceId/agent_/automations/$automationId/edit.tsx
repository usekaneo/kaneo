import { createFileRoute } from "@tanstack/react-router";
import { AutomationEditPage } from "@/components/agent/automation/automation-edit-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/agent_/automations/$automationId/edit",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, automationId } = Route.useParams();
  return (
    <AutomationEditPage
      key={automationId}
      workspaceId={workspaceId}
      automationId={automationId}
    />
  );
}
