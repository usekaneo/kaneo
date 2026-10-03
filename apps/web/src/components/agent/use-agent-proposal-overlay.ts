import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import useAgentRun from "@/hooks/queries/agent/use-agent-run";
import { useAgentPanelStore } from "@/store/agent-panel";
import { describeAgentProposal } from "./describe-agent-proposal";
import { useAgentValueFormatter } from "./use-agent-value-formatter";

// Publishes short labels for the run's pending task updates so board cards
// can preview them. Never touches the board cache itself.
export function useAgentProposalOverlay(
  workspaceId: string,
  runId: string | undefined,
) {
  const { t } = useTranslation();
  const format = useAgentValueFormatter();
  const setProposed = useAgentPanelStore((state) => state.setProposed);
  const { data: run } = useAgentRun(workspaceId, runId);

  useEffect(() => {
    const labels: Record<string, string> = {};
    for (const proposal of run?.proposals ?? []) {
      if (proposal.status !== "pending") continue;
      const summary = describeAgentProposal(proposal);
      if (!summary.taskId) continue;
      const [change, ...rest] = summary.changes;
      labels[summary.taskId] =
        !change || rest.length > 0
          ? t("agent:overlay.update")
          : change.field === "title"
            ? t("agent:overlay.rename")
            : t(`agent:overlay.${change.field}`, {
                value: format(change.field, change.to),
              });
    }
    setProposed(labels);
  }, [run, t, format, setProposed]);

  useEffect(() => () => setProposed({}), [setProposed]);
}
