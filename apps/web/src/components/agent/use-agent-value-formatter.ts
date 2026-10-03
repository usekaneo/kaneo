import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { formatDate } from "@/lib/format";
import { getPriorityLabel } from "@/lib/i18n/domain";
import type { AgentProposalField } from "./describe-agent-proposal";

export function useAgentValueFormatter() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: users } = useGetActiveWorkspaceUsers(workspace?.id ?? "");

  return useCallback(
    (field: AgentProposalField, value: string | null) => {
      if (field === "assignee") {
        if (!value) return t("agent:proposal.unassigned");
        return (
          users?.members?.find((member) => member.userId === value)?.user
            ?.name ?? t("agent:proposal.unknownMember")
        );
      }
      if (field === "dueDate") {
        if (!value) return t("agent:proposal.noDueDate");
        return formatDate(value, {
          weekday: "short",
          month: "short",
          day: "numeric",
        });
      }
      if (field === "priority") return getPriorityLabel(value ?? "no-priority");
      return value ?? "";
    },
    [t, users],
  );
}
