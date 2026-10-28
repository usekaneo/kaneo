import { createFileRoute } from "@tanstack/react-router";
import { AutomationsPage } from "@/components/agent/automation/automations-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/agent_/automations/",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  return <AutomationsPage workspaceId={workspaceId} />;
}
