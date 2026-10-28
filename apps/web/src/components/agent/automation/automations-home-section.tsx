import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import useAutomations from "@/hooks/queries/agent-automation/use-automations";
import { AutomationHomeRow } from "./automation-home-row";
import { AutomationHomeRuleRow } from "./automation-home-rule-row";
import { useAutomationTriggerLabel } from "./use-automation-trigger-label";

const HOME_LIMIT = "4";

type AutomationsHomeSectionProps = {
  workspaceId: string;
  canCreate: boolean;
};

export function AutomationsHomeSection({
  workspaceId,
  canCreate,
}: AutomationsHomeSectionProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const triggerLabel = useAutomationTriggerLabel(workspaceId);
  const { data, isPending, isError, refetch } = useAutomations(workspaceId, {
    limit: HOME_LIMIT,
  });

  return (
    <section className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-2 border-border/80 border-b pb-2">
        <h2 className="font-semibold text-[15px] text-foreground">
          {t("agent:automations.title")}
        </h2>
        <div className="flex items-center gap-0.5">
          {canCreate && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              render={
                <Link
                  to="/dashboard/workspace/$workspaceId/agent/automations/new"
                  params={{ workspaceId }}
                />
              }
            >
              {t("agent:automations.newShort")}
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            render={
              <Link
                to="/dashboard/workspace/$workspaceId/agent/automations"
                params={{ workspaceId }}
              />
            }
          >
            {t("agent:automations.viewAll")}
          </Button>
        </div>
      </div>
      {isPending ? (
        <p role="status" className="py-4 text-muted-foreground text-sm">
          {t("common:empty.loading")}
        </p>
      ) : isError ? (
        <div className="flex items-center gap-3 py-4">
          <p role="alert" className="text-muted-foreground text-sm">
            {t("agent:automations.loadError")}
          </p>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            {t("common:error.tryAgain")}
          </Button>
        </div>
      ) : data.items.length === 0 ? (
        <p className="py-4 text-muted-foreground text-sm">
          {t("agent:automations.empty")}
        </p>
      ) : (
        <ul>
          {data.items.map((item) =>
            item.kind === "agent" ? (
              <AutomationHomeRow
                key={item.id}
                workspaceId={workspaceId}
                automation={item}
                isOwner={item.owner.id === user?.id}
                triggerLabel={triggerLabel(item.trigger)}
              />
            ) : (
              <AutomationHomeRuleRow key={`rule:${item.id}`} rule={item} />
            ),
          )}
        </ul>
      )}
    </section>
  );
}
