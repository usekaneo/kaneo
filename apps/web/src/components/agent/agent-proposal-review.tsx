import { Undo2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import useReviewAgentProposals from "@/hooks/mutations/agent/use-review-agent-proposals";
import { HttpError } from "@/lib/http-error";
import { toast } from "@/lib/toast";
import type { AgentProposal, AgentRun } from "@/types/agent";
import { AgentProposalRow } from "./agent-proposal-row";
import { getAgentErrorKey } from "./get-agent-error-key";

type AgentProposalReviewProps = {
  workspaceId: string;
  run: AgentRun;
  getTaskKey?: (taskId: string) => string | undefined;
  readOnly?: boolean;
};

export function AgentProposalReview({
  workspaceId,
  run,
  getTaskKey,
  readOnly = false,
}: AgentProposalReviewProps) {
  const { t } = useTranslation();
  const { apply, discard, undo } = useReviewAgentProposals(workspaceId, run.id);
  // Track opt-outs so proposals arriving later start selected.
  const [deselected, setDeselected] = useState<ReadonlySet<string>>(new Set());
  const proposals = run.proposals.filter(
    (proposal) => proposal.status !== "discarded",
  );
  const pending = proposals.filter((proposal) => proposal.status === "pending");
  const selectedIds = pending
    .filter((proposal) => !deselected.has(proposal.id))
    .map((proposal) => proposal.id);
  const appliedCount = proposals.filter(
    (proposal) => proposal.status === "applied",
  ).length;
  const busy = apply.isPending || discard.isPending || undo.isPending;
  const canReview =
    !readOnly && run.status === "awaiting_review" && pending.length > 0;

  if (proposals.length === 0) return null;

  const handleApply = async () => {
    try {
      const { results } = await apply.mutateAsync(selectedIds);
      const failed = results.filter((result) => result.status === "failed");
      const applied = results.length - failed.length;
      if (applied > 0)
        toast.success(t("agent:review.appliedToast", { count: applied }));
      if (failed.length > 0)
        toast.error(t("agent:review.failedToast", { count: failed.length }), {
          description: t("agent:review.failedDescription"),
        });
    } catch (error) {
      toast.error(t(getAgentErrorKey(error)));
    }
  };

  const handleDiscard = async () => {
    try {
      await discard.mutateAsync(pending.map((proposal) => proposal.id));
    } catch (error) {
      toast.error(t(getAgentErrorKey(error)));
    }
  };

  const handleUndo = async (proposal: AgentProposal) => {
    try {
      await undo.mutateAsync(proposal.id);
      toast.success(t("agent:review.undoneToast"));
    } catch (error) {
      toast.error(
        t(
          error instanceof HttpError && error.status === 409
            ? proposal.action.type === "comment.create"
              ? "agent:review.undoCommentConflict"
              : "agent:review.undoConflict"
            : getAgentErrorKey(error),
        ),
      );
    }
  };

  return (
    <section
      aria-label={t("agent:review.label")}
      className="overflow-hidden rounded-xl border border-border bg-card shadow-xs/5"
    >
      <header className="flex items-center justify-between gap-2 border-border/60 border-b bg-muted/30 px-3 py-2.5">
        <div className="flex items-center gap-2">
          {pending.length > 0 && (
            <span
              aria-hidden="true"
              className="size-1.5 shrink-0 rounded-full bg-info"
            />
          )}
          <h3 className="font-semibold text-[13px] text-foreground">
            {t("agent:review.title", { count: proposals.length })}
          </h3>
        </div>
        <span className="text-muted-foreground text-xs">
          {appliedCount > 0
            ? t("agent:review.appliedCount", { count: appliedCount })
            : t("agent:review.nothingApplied")}
        </span>
      </header>
      <ul>
        {proposals.map((proposal) => (
          <AgentProposalRow
            key={proposal.id}
            proposal={proposal}
            taskKey={
              proposal.action.type === "task.create"
                ? undefined
                : getTaskKey?.(proposal.action.taskId)
            }
            selected={!deselected.has(proposal.id)}
            disabled={busy || !canReview}
            onSelectedChange={
              readOnly
                ? undefined
                : (selected) =>
                    setDeselected((current) => {
                      const next = new Set(current);
                      if (selected) next.delete(proposal.id);
                      else next.add(proposal.id);
                      return next;
                    })
            }
            onUndo={readOnly ? undefined : () => void handleUndo(proposal)}
          />
        ))}
      </ul>
      {canReview && (
        <footer className="flex items-center justify-between gap-2 border-border/60 border-t px-3 py-2.5">
          <span className="flex items-center gap-1.5 text-muted-foreground text-xs">
            <Undo2 aria-hidden="true" className="size-3" />
            {t("agent:review.undoHint")}
          </span>
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={busy}
              onClick={() => void handleDiscard()}
            >
              {t("agent:review.discard")}
            </Button>
            <Button
              size="sm"
              disabled={busy || selectedIds.length === 0}
              onClick={() => void handleApply()}
            >
              {t("agent:review.apply", { count: selectedIds.length })}
            </Button>
          </div>
        </footer>
      )}
    </section>
  );
}
