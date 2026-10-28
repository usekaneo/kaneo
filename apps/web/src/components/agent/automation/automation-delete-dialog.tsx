import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import useDeleteAutomation from "@/hooks/mutations/agent-automation/use-delete-automation";
import { toast } from "@/lib/toast";
import { getAutomationErrorKey } from "./get-automation-error-key";

type AutomationDeleteDialogProps = {
  workspaceId: string;
  automation: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AutomationDeleteDialog({
  workspaceId,
  automation,
  open,
  onOpenChange,
}: AutomationDeleteDialogProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const remove = useDeleteAutomation(workspaceId);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t("agent:automations.delete.title", { name: automation.name })}
      confirmLabel={t("agent:automations.delete.confirm")}
      pending={remove.isPending}
      onConfirm={() =>
        remove.mutate(automation.id, {
          onSuccess: () => {
            onOpenChange(false);
            toast.success(t("agent:automations.delete.toast"));
            void navigate({
              to: "/dashboard/workspace/$workspaceId/agent/automations",
              params: { workspaceId },
            });
          },
          onError: (error) => toast.error(t(getAutomationErrorKey(error))),
        })
      }
    />
  );
}
