import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import WorkspaceLayout from "@/components/common/workspace-layout";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useAutomationsBreadcrumbs } from "./use-automations-breadcrumbs";

type AutomationPageStateProps = {
  workspaceId: string;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
};

// Loading and failure states for pages of one automation.
export function AutomationPageState({
  workspaceId,
  loading,
  failed,
  onRetry,
}: AutomationPageStateProps) {
  const { t } = useTranslation();
  const parents = useAutomationsBreadcrumbs(workspaceId);
  const [agent, automations] = parents;

  return (
    <WorkspaceLayout
      title={automations?.label ?? ""}
      parents={agent ? [agent] : []}
    >
      <div className="flex h-full flex-col items-center justify-center gap-4 p-6">
        {loading ? (
          <Spinner
            className="size-4 text-muted-foreground"
            aria-label={t("common:empty.loading")}
          />
        ) : failed ? (
          <>
            <p role="alert" className="font-medium text-foreground text-sm">
              {t("agent:automations.notFound")}
            </p>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onRetry}>
                {t("common:error.tryAgain")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                render={
                  <Link
                    to="/dashboard/workspace/$workspaceId/agent/automations"
                    params={{ workspaceId }}
                  />
                }
              >
                {t("agent:automations.backToList")}
              </Button>
            </div>
          </>
        ) : null}
      </div>
    </WorkspaceLayout>
  );
}
