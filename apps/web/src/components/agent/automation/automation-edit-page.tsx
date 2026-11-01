import { Navigate } from "@tanstack/react-router";
import useAutomation from "@/hooks/queries/agent-automation/use-automation";
import { AutomationEditForm } from "./automation-edit-form";
import { AutomationPageState } from "./automation-page-state";

type AutomationEditPageProps = {
  workspaceId: string;
  automationId: string;
};

export function AutomationEditPage({
  workspaceId,
  automationId,
}: AutomationEditPageProps) {
  const {
    data: automation,
    isPending,
    isError,
    refetch,
  } = useAutomation(workspaceId, automationId);

  if (!automation)
    return (
      <AutomationPageState
        workspaceId={workspaceId}
        loading={isPending}
        failed={isError}
        onRetry={() => void refetch()}
      />
    );
  // Only the owner edits; everyone else gets the read-only page.
  if (!automation.viewer.isOwner)
    return (
      <Navigate
        to="/dashboard/workspace/$workspaceId/agent/automations/$automationId"
        params={{ workspaceId, automationId }}
        replace
      />
    );
  return (
    <AutomationEditForm workspaceId={workspaceId} automation={automation} />
  );
}
