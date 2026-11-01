import { createFileRoute } from "@tanstack/react-router";
import { AutomationFormPage } from "@/components/agent/automation/automation-form-page";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/agent_/automations/new",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId } = Route.useParams();
  return <AutomationFormPage workspaceId={workspaceId} />;
}
