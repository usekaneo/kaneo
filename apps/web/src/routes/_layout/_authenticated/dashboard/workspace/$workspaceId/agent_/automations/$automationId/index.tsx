import { createFileRoute } from "@tanstack/react-router";
import { AutomationDetailPage } from "@/components/agent/automation/automation-detail-page";

type AutomationSearchParams = {
  runId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/agent_/automations/$automationId/",
)({
  component: RouteComponent,
  validateSearch: (
    search: Record<string, unknown>,
  ): AutomationSearchParams => ({
    runId: typeof search.runId === "string" ? search.runId : undefined,
  }),
});

function RouteComponent() {
  const { workspaceId, automationId } = Route.useParams();
  const { runId } = Route.useSearch();
  return (
    <AutomationDetailPage
      key={automationId}
      workspaceId={workspaceId}
      automationId={automationId}
      runId={runId}
    />
  );
}
