import useAutomation from "@/hooks/queries/agent-automation/use-automation";
import { AutomationDetail } from "./automation-detail";
import { AutomationPageState } from "./automation-page-state";

type AutomationDetailPageProps = {
  workspaceId: string;
  automationId: string;
  runId: string | undefined;
};

export function AutomationDetailPage({
  workspaceId,
  automationId,
  runId,
}: AutomationDetailPageProps) {
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
  return (
    <AutomationDetail
      workspaceId={workspaceId}
      automation={automation}
      runId={runId}
    />
  );
}
