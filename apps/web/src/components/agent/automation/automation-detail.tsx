import { useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import useAgentConfig from "@/hooks/queries/agent/use-agent-config";
import useAutomationRuns from "@/hooks/queries/agent-automation/use-automation-runs";
import type { Automation } from "@/types/agent-automation";
import { AutomationMeta } from "./automation-meta";
import { AutomationOwnerActions } from "./automation-owner-actions";
import { AutomationPromptPreview } from "./automation-prompt-preview";
import { AutomationRunList } from "./automation-run-list";
import { AutomationRunPanel } from "./automation-run-panel";
import { AutomationStateLine } from "./automation-state-line";
import { AutomationTakeOverDialog } from "./automation-take-over-dialog";
import { formatCost } from "./format-run-meta";
import { useAutomationsBreadcrumbs } from "./use-automations-breadcrumbs";

const RUNS_PAGE_SIZE = 20;

type AutomationDetailProps = {
  workspaceId: string;
  automation: Automation;
  runId: string | undefined;
};

export function AutomationDetail({
  workspaceId,
  automation,
  runId,
}: AutomationDetailProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const parents = useAutomationsBreadcrumbs(workspaceId);
  const { data: config } = useAgentConfig(workspaceId);
  const [page, setPage] = useState(0);
  const [takingOver, setTakingOver] = useState(false);
  const { isOwner } = automation.viewer;
  // Takeover is for automations whose owner lost access; never automatic.
  const canTakeOver =
    automation.viewer.canTakeOver && automation.pausedReason === "owner_access";
  // Admins who may take over see settings, but not the prompt or history.
  const canReadRuns = automation.prompt !== null;
  const runs = useAutomationRuns(
    workspaceId,
    automation.id,
    {
      limit: String(RUNS_PAGE_SIZE),
      offset: String(page * RUNS_PAGE_SIZE),
    },
    canReadRuns,
  );
  const selected = runId
    ? runs.data?.find((run) => run.id === runId)
    : runs.data?.[0];
  const selectedId = runId ?? selected?.id;
  const monthCost = formatCost(
    automation.monthCostUsd,
    i18n.resolvedLanguage || i18n.language,
  );

  return (
    <>
      <PageTitle title={automation.name} />
      <WorkspaceLayout title={automation.name} parents={parents}>
        <div className="h-full overflow-y-auto">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-10 sm:px-14">
            <header className="flex flex-col gap-3 pt-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <h1 className="min-w-0 break-words font-semibold text-2xl text-foreground tracking-tight">
                  {automation.name}
                </h1>
                {isOwner ? (
                  <AutomationOwnerActions
                    workspaceId={workspaceId}
                    automation={automation}
                    agentEnabled={config?.enabled === true}
                  />
                ) : canTakeOver ? (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setTakingOver(true)}
                  >
                    {t("agent:automations.takeOver.action")}
                  </Button>
                ) : null}
              </div>
              <AutomationMeta
                workspaceId={workspaceId}
                automation={automation}
              />
              <AutomationStateLine automation={automation} />
              {automation.prompt !== null && (
                <AutomationPromptPreview prompt={automation.prompt} />
              )}
            </header>

            {canReadRuns && (
              <div className="grid gap-10 lg:grid-cols-[20rem_minmax(0,1fr)]">
                <AutomationRunList
                  runs={runs.data}
                  isPending={runs.isPending}
                  isError={runs.isError}
                  onRetry={() => void runs.refetch()}
                  selectedId={selectedId}
                  onSelect={(id) =>
                    void navigate({
                      to: "/dashboard/workspace/$workspaceId/agent/automations/$automationId",
                      params: { workspaceId, automationId: automation.id },
                      search: { runId: id },
                      replace: true,
                    })
                  }
                  monthCost={monthCost}
                  page={page}
                  pageSize={RUNS_PAGE_SIZE}
                  onPageChange={setPage}
                />
                {selectedId && (
                  <AutomationRunPanel
                    key={selectedId}
                    workspaceId={workspaceId}
                    runId={selectedId}
                    automationId={automation.id}
                    conversationId={automation.conversationId}
                    summary={selected}
                    readOnly={!isOwner}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </WorkspaceLayout>
      {canTakeOver && (
        <AutomationTakeOverDialog
          workspaceId={workspaceId}
          automation={automation}
          open={takingOver}
          onOpenChange={setTakingOver}
        />
      )}
    </>
  );
}
