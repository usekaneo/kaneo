import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { type FormEvent, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { getAgentCodeErrorKey } from "@/components/agent/code/get-agent-code-error-key";
import { GithubIcon } from "@/components/icons/github-icon";
import { Button } from "@/components/ui/button";
import {
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogPanel,
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
import { Textarea } from "@/components/ui/textarea";
import getAgentRun from "@/fetchers/agent/get-agent-run";
import useStartAgentCodeJob from "@/hooks/mutations/agent/use-start-agent-code-job";
import { agentQueryKeys } from "@/hooks/queries/agent/agent-query-keys";
import { toast } from "@/lib/toast";
import type { AgentCodeRepository } from "@/types/agent";
import { draftAgentCodeInstructions } from "./draft-agent-code-instructions";

type TaskAgentCodeFormProps = {
  workspaceId: string;
  task: { id: string; title: string; description?: string | null };
  repositories: AgentCodeRepository[];
  onDone: () => void;
};

// Mounted per dialog opening, so each opening drafts fresh instructions and
// gets its own request ID; retrying a submit reuses it and stays idempotent.
export function TaskAgentCodeForm({
  workspaceId,
  task,
  repositories,
  onDone,
}: TaskAgentCodeFormProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const start = useStartAgentCodeJob(workspaceId);
  const repositoryLabelId = useId();
  const instructionsId = useId();
  const [requestId] = useState(() => crypto.randomUUID());
  const [integrationId, setIntegrationId] = useState(
    repositories[0]?.integrationId ?? "",
  );
  const [instructions, setInstructions] = useState(() =>
    draftAgentCodeInstructions(task),
  );
  const repository = repositories.find(
    (candidate) => candidate.integrationId === integrationId,
  );
  const canSubmit = Boolean(repository) && instructions.trim().length > 0;

  const openRun = async (runId: string) => {
    try {
      const run = await queryClient.fetchQuery({
        queryKey: agentQueryKeys.run(workspaceId, runId),
        queryFn: () => getAgentRun(workspaceId, runId),
      });
      await navigate({
        to: "/dashboard/workspace/$workspaceId/agent",
        params: { workspaceId },
        search: { conversationId: run.conversationId },
      });
    } catch (error) {
      toast.error(t(getAgentCodeErrorKey(error)));
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    start.mutate(
      {
        requestId,
        taskId: task.id,
        integrationId,
        instructions: instructions.trim(),
      },
      {
        onSuccess: (job) => {
          onDone();
          toast.success(t("agent:code.start.toast"), {
            action: {
              label: t("agent:code.start.openRun"),
              onClick: () => void openRun(job.runId),
            },
          });
        },
        onError: (error) => toast.error(t(getAgentCodeErrorKey(error))),
      },
    );
  };

  return (
    <form className="contents" onSubmit={handleSubmit}>
      <DialogHeader>
        <DialogTitle>{t("agent:code.start.title")}</DialogTitle>
      </DialogHeader>
      <DialogPanel className="flex flex-col gap-5">
        <div className="flex flex-col gap-2">
          <Label id={repositoryLabelId} render={<span />}>
            {t("agent:code.start.repository")}
          </Label>
          {repositories.length > 1 ? (
            <Select
              value={integrationId}
              onValueChange={(value) => {
                if (value) setIntegrationId(value);
              }}
            >
              <SelectTrigger
                size="sm"
                aria-labelledby={repositoryLabelId}
                disabled={start.isPending}
              >
                <SelectValue>{repository?.fullName}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {repositories.map((candidate) => (
                  <SelectItem
                    key={candidate.integrationId}
                    value={candidate.integrationId}
                  >
                    {candidate.fullName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <p className="flex min-w-0 items-center gap-2 text-foreground text-sm">
              <GithubIcon className="size-3.5 shrink-0" />
              <span className="truncate">{repository?.fullName}</span>
            </p>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={instructionsId}>
            {t("agent:code.start.instructions")}
          </Label>
          <Textarea
            id={instructionsId}
            value={instructions}
            maxLength={8000}
            disabled={start.isPending}
            className="max-h-72 overflow-y-auto"
            onChange={(event) => setInstructions(event.target.value)}
          />
        </div>
      </DialogPanel>
      <DialogFooter>
        <DialogClose
          render={<Button variant="outline" size="sm" />}
          disabled={start.isPending}
        >
          {t("common:actions.cancel")}
        </DialogClose>
        <Button
          type="submit"
          size="sm"
          disabled={!canSubmit}
          loading={start.isPending}
        >
          {t("agent:code.start.submit")}
        </Button>
      </DialogFooter>
    </form>
  );
}
