import { useTranslation } from "react-i18next";
import type { AgentConversationOwner } from "@/types/agent";
import { AgentOwnerAvatar } from "../agent-owner-avatar";

export function AutomationRunsAs({
  owner,
  isViewer,
}: {
  owner: AgentConversationOwner;
  isViewer: boolean;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="font-medium text-foreground">
        {t("agent:automations.form.runsAs")}
      </span>
      <span className="flex min-w-0 items-center gap-2 text-muted-foreground">
        <AgentOwnerAvatar owner={owner} />
        <span className="truncate">
          {isViewer ? t("agent:automations.you") : owner.name}
        </span>
      </span>
    </div>
  );
}
