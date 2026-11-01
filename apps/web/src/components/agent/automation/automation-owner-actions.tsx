import { Link, useNavigate } from "@tanstack/react-router";
import { EllipsisIcon, Play, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import useRunAutomation from "@/hooks/mutations/agent-automation/use-run-automation";
import { toast } from "@/lib/toast";
import type { Automation } from "@/types/agent-automation";
import { AgentShareButton } from "../agent-share-button";
import { AutomationDeleteDialog } from "./automation-delete-dialog";
import { AutomationEnabledSwitch } from "./automation-enabled-switch";
import { getAutomationErrorKey } from "./get-automation-error-key";

type AutomationOwnerActionsProps = {
  workspaceId: string;
  automation: Automation;
  agentEnabled: boolean;
};

export function AutomationOwnerActions({
  workspaceId,
  automation,
  agentEnabled,
}: AutomationOwnerActionsProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const run = useRunAutomation(workspaceId);
  const [deleting, setDeleting] = useState(false);

  const runNow = () =>
    run.mutate(automation.id, {
      onSuccess: ({ id }) => {
        toast.success(t("agent:automations.runNowToast"));
        void navigate({
          to: "/dashboard/workspace/$workspaceId/agent/automations/$automationId",
          params: { workspaceId, automationId: automation.id },
          search: { runId: id },
          replace: true,
        });
      },
      onError: (error) => toast.error(t(getAutomationErrorKey(error))),
    });

  return (
    <div className="flex shrink-0 items-center gap-2">
      <AutomationEnabledSwitch
        workspaceId={workspaceId}
        automation={automation}
      />
      <Button
        variant="outline"
        size="sm"
        disabled={!automation.enabled || !agentEnabled || run.isPending}
        onClick={runNow}
      >
        <Play aria-hidden="true" />
        {t("agent:automations.runNow")}
      </Button>
      <Button
        variant="outline"
        size="sm"
        render={
          <Link
            to="/dashboard/workspace/$workspaceId/agent/automations/$automationId/edit"
            params={{ workspaceId, automationId: automation.id }}
          />
        }
      >
        {t("agent:automations.edit")}
      </Button>
      {automation.conversationId && (
        <AgentShareButton
          workspaceId={workspaceId}
          conversationId={automation.conversationId}
        />
      )}
      <Menu>
        <MenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground"
              aria-label={t("agent:automations.moreActions")}
            />
          }
        >
          <EllipsisIcon aria-hidden="true" />
        </MenuTrigger>
        <MenuPopup align="end">
          <MenuItem
            variant="destructive"
            closeOnClick
            onClick={() => setDeleting(true)}
          >
            <Trash2 aria-hidden="true" />
            {t("agent:automations.delete.action")}
          </MenuItem>
        </MenuPopup>
      </Menu>
      <AutomationDeleteDialog
        workspaceId={workspaceId}
        automation={automation}
        open={deleting}
        onOpenChange={setDeleting}
      />
    </div>
  );
}
