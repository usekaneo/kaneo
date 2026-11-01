import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import useTakeOverAutomation from "@/hooks/mutations/agent-automation/use-take-over-automation";
import { toast } from "@/lib/toast";
import { getAutomationErrorKey } from "./get-automation-error-key";

type AutomationTakeOverDialogProps = {
  workspaceId: string;
  automation: { id: string; name: string };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function AutomationTakeOverDialog({
  workspaceId,
  automation,
  open,
  onOpenChange,
}: AutomationTakeOverDialogProps) {
  const { t } = useTranslation();
  const takeOver = useTakeOverAutomation(workspaceId);

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      destructive={false}
      title={t("agent:automations.takeOver.title", { name: automation.name })}
      confirmLabel={t("agent:automations.takeOver.confirm")}
      pending={takeOver.isPending}
      onConfirm={() =>
        takeOver.mutate(automation.id, {
          onSuccess: () => {
            onOpenChange(false);
            toast.success(t("agent:automations.takeOver.toast"));
          },
          onError: (error) => toast.error(t(getAutomationErrorKey(error))),
        })
      }
    />
  );
}
