import { useTranslation } from "react-i18next";
import { formatDate, formatDateTime } from "@/lib/format";
import type { AgentAutomationListItem } from "@/types/agent-automation";
import { AutomationStatusLabel } from "./automation-status-label";
import { getAutomationStatus } from "./get-automation-status";

export function AutomationNextRun({
  automation,
}: {
  automation: AgentAutomationListItem;
}) {
  const { t } = useTranslation();
  const status = getAutomationStatus(automation);
  if (status) return <AutomationStatusLabel status={status} />;
  if (automation.trigger.type === "event")
    return (
      <span className="text-muted-foreground">
        {t("agent:automations.onEvent")}
      </span>
    );
  if (!automation.nextRunAt)
    return <span className="text-muted-foreground">—</span>;
  return (
    <time
      dateTime={automation.nextRunAt}
      title={formatDateTime(automation.nextRunAt)}
      className="truncate text-foreground"
    >
      {formatDate(automation.nextRunAt, {
        weekday: "short",
        month: "short",
        day: "numeric",
      })}
    </time>
  );
}
