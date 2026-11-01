import { Link } from "@tanstack/react-router";
import { Plus } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import useAgentConfig from "@/hooks/queries/agent/use-agent-config";
import useAutomations from "@/hooks/queries/agent-automation/use-automations";
import useGetProjects from "@/hooks/queries/project/use-get-projects";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { AutomationFilterMenu } from "./automation-filter-menu";
import {
  type AutomationKind,
  AutomationKindTabs,
} from "./automation-kind-tabs";
import { AutomationListRow } from "./automation-list-row";
import { AutomationRuleListRow } from "./automation-rule-list-row";
import { AutomationsEmpty } from "./automations-empty";
import { AutomationsListSkeleton } from "./automations-list-skeleton";
import { AutomationsPagination } from "./automations-pagination";
import { AutomationsTableHeader } from "./automations-table-header";
import { useAutomationTriggerLabel } from "./use-automation-trigger-label";

const PAGE_SIZE = 20;

export function AutomationsPage({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [kind, setKind] = useState<AutomationKind>("all");
  const [projectId, setProjectId] = useState<string>();
  const [ownerId, setOwnerId] = useState<string>();
  const [offset, setOffset] = useState(0);
  const { data: config } = useAgentConfig(workspaceId);
  const { data: projects } = useGetProjects({ workspaceId });
  const { data: members } = useGetActiveWorkspaceUsers(workspaceId);
  const triggerLabel = useAutomationTriggerLabel(workspaceId);
  const { data, isPending, isError, refetch } = useAutomations(workspaceId, {
    kind,
    ...(projectId ? { projectId } : {}),
    ...(ownerId ? { ownerId } : {}),
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  const filtered = Boolean(projectId || ownerId);
  const title = t("agent:automations.title");

  // Any filter change starts again on the first page.
  const refilter =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setOffset(0);
    };

  return (
    <>
      <PageTitle title={title} />
      <WorkspaceLayout
        title={title}
        parents={[
          {
            label: t("agent:title"),
            link: (
              <Link
                to="/dashboard/workspace/$workspaceId/agent"
                params={{ workspaceId }}
              />
            ),
          },
        ]}
      >
        <div className="h-full overflow-y-auto">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-10 sm:px-14">
            <header className="flex items-center justify-between gap-4 pt-4">
              <h1 className="font-semibold text-2xl text-foreground tracking-tight">
                {title}
              </h1>
              {config?.enabled && (
                <Button
                  size="sm"
                  render={
                    <Link
                      to="/dashboard/workspace/$workspaceId/agent/automations/new"
                      params={{ workspaceId }}
                    />
                  }
                >
                  <Plus aria-hidden="true" />
                  {t("agent:automations.new")}
                </Button>
              )}
            </header>

            {data?.counts.all === 0 && !filtered ? (
              <AutomationsEmpty title={t("agent:automations.empty")} />
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <AutomationKindTabs
                    value={kind}
                    onValueChange={refilter(setKind)}
                    counts={data?.counts}
                  />
                  <div className="flex flex-wrap items-center gap-1.5">
                    <AutomationFilterMenu
                      label={t("agent:automations.filters.project")}
                      options={(projects ?? []).map((project) => ({
                        id: project.id,
                        label: project.name,
                      }))}
                      value={projectId}
                      onValueChange={refilter(setProjectId)}
                    />
                    <AutomationFilterMenu
                      label={t("agent:automations.filters.owner")}
                      options={(members?.members ?? []).map((member) => ({
                        id: member.userId,
                        label:
                          member.userId === user?.id
                            ? t("agent:automations.you")
                            : member.user.name,
                      }))}
                      value={ownerId}
                      onValueChange={refilter(setOwnerId)}
                    />
                  </div>
                </div>

                <div>
                  <AutomationsTableHeader />
                  {isPending ? (
                    <AutomationsListSkeleton />
                  ) : isError ? (
                    <div className="flex items-center gap-3 py-6">
                      <p role="alert" className="text-muted-foreground text-sm">
                        {t("agent:automations.loadError")}
                      </p>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void refetch()}
                      >
                        {t("common:error.tryAgain")}
                      </Button>
                    </div>
                  ) : data.items.length === 0 ? (
                    <AutomationsEmpty
                      title={t("agent:automations.noMatches")}
                    />
                  ) : (
                    <ul>
                      {data.items.map((item) =>
                        item.kind === "agent" ? (
                          <AutomationListRow
                            key={item.id}
                            workspaceId={workspaceId}
                            automation={item}
                            isOwner={item.owner.id === user?.id}
                            triggerLabel={triggerLabel(item.trigger)}
                          />
                        ) : (
                          <AutomationRuleListRow
                            key={`rule:${item.id}`}
                            rule={item}
                          />
                        ),
                      )}
                    </ul>
                  )}
                  {data && (
                    <AutomationsPagination
                      offset={offset}
                      pageSize={PAGE_SIZE}
                      total={data.total}
                      onOffsetChange={setOffset}
                    />
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </WorkspaceLayout>
    </>
  );
}
