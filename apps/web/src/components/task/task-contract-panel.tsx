import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileSignature, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  getContractSubmission,
  getContractTemplates,
  sendContract,
} from "@/fetchers/contract/contract-api";
import { useClients } from "@/hooks/queries/client/use-clients";
import { toast } from "@/lib/toast";

type TaskContractPanelProps = {
  taskId: string;
  workspaceId: string;
};

function isContractTaskType(taskType?: string | null) {
  if (!taskType) return false;
  const normalized = taskType.toLowerCase();
  return normalized === "contract" || normalized === "contrato";
}

export default function TaskContractPanel({
  taskId,
  workspaceId,
  taskType,
}: TaskContractPanelProps & { taskType?: string | null }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState("");
  const [clientId, setClientId] = useState("");

  const enabled = isContractTaskType(taskType);

  const { data: submission, isLoading } = useQuery({
    queryKey: ["contract-submission", taskId],
    queryFn: () => getContractSubmission(taskId),
    enabled: enabled && Boolean(taskId),
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["contract-templates", workspaceId],
    queryFn: () => getContractTemplates(workspaceId),
    enabled: open && Boolean(workspaceId),
  });

  const { data: clients = [] } = useClients(workspaceId);

  const sendMutation = useMutation({
    mutationFn: sendContract,
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: ["contract-submission", taskId],
      });
      setOpen(false);
      toast.success(t("contracts:panel.sentSuccess"));
    },
    onError: (error) => {
      toast.error(
        error instanceof Error ? error.message : t("contracts:panel.sentError"),
      );
    },
  });

  const statusLabel = useMemo(() => {
    if (!submission) return null;
    return t(`contracts:status.${submission.status}`, {
      defaultValue: submission.status,
    });
  }, [submission, t]);

  if (!enabled) return null;

  return (
    <div className="rounded-lg border border-border p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FileSignature className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">
            {t("contracts:panel.title")}
          </h3>
        </div>
        {submission ? (
          <Badge variant="outline">{statusLabel}</Badge>
        ) : (
          <Button size="sm" onClick={() => setOpen(true)}>
            {t("contracts:panel.start")}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          {t("contracts:panel.loading")}
        </div>
      ) : submission ? (
        <p className="text-sm text-muted-foreground">
          {t("contracts:panel.submissionId", {
            id: submission.docusealSubmissionId,
          })}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("contracts:panel.empty")}
        </p>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("contracts:panel.modalTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("contracts:panel.template")}</Label>
              <Select
                value={templateId}
                onValueChange={(value) => setTemplateId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={t("contracts:panel.pickTemplate")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("contracts:panel.client")}</Label>
              <Select
                value={clientId}
                onValueChange={(value) => setClientId(value ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("contracts:panel.pickClient")} />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((clientRecord) => (
                    <SelectItem key={clientRecord.id} value={clientRecord.id}>
                      {clientRecord.name} ({clientRecord.cnpj})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              disabled={!templateId || !clientId || sendMutation.isPending}
              onClick={() =>
                sendMutation.mutate({
                  workspaceId,
                  taskId,
                  templateId,
                  clientId,
                })
              }
            >
              {sendMutation.isPending
                ? t("contracts:panel.sending")
                : t("contracts:panel.send")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
