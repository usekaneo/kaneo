import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ConfirmDialog } from "@/components/settings/confirm-dialog";
import { Button } from "@/components/ui/button";
import useCancelAgentCodeJob from "@/hooks/mutations/agent/use-cancel-agent-code-job";
import { toast } from "@/lib/toast";
import { getAgentCodeErrorKey } from "./get-agent-code-error-key";

type AgentCodeJobCancelButtonProps = {
  workspaceId: string;
  jobId: string;
};

export function AgentCodeJobCancelButton({
  workspaceId,
  jobId,
}: AgentCodeJobCancelButtonProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const cancel = useCancelAgentCodeJob(workspaceId);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        {t("agent:code.cancel.action")}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={t("agent:code.cancel.title")}
        confirmLabel={t("agent:code.cancel.confirm")}
        pending={cancel.isPending}
        onConfirm={() =>
          cancel.mutate(jobId, {
            onSuccess: () => {
              setOpen(false);
              toast.success(t("agent:code.cancel.toast"));
            },
            onError: (error) => {
              setOpen(false);
              toast.error(t(getAgentCodeErrorKey(error)));
            },
          })
        }
      />
    </>
  );
}
