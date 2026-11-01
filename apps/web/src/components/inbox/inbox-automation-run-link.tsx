import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";

type InboxAutomationRunLinkProps = {
  workspaceId: string;
  automationId: string;
  runId: string;
};

export function InboxAutomationRunLink({
  workspaceId,
  automationId,
  runId,
}: InboxAutomationRunLinkProps) {
  const { t } = useTranslation();
  return (
    <Button
      variant="outline"
      size="sm"
      className="self-start"
      render={
        <Link
          to="/dashboard/workspace/$workspaceId/agent/automations/$automationId"
          params={{ workspaceId, automationId }}
          search={{ runId }}
        />
      }
    >
      {t("agent:automations.openRun")}
    </Button>
  );
}
