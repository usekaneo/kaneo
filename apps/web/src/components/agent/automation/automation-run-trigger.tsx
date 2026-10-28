import { Clock, Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateTime } from "@/lib/format";
import type { AutomationRun } from "@/types/agent-automation";
import { AutomationRunEvent } from "./automation-run-event";

type AutomationRunTriggerProps = {
  workspaceId: string;
  trigger: AutomationRun["trigger"];
};

// What started the run: a schedule slot, Run now, or a batch of events.
export function AutomationRunTrigger({
  workspaceId,
  trigger,
}: AutomationRunTriggerProps) {
  const { t } = useTranslation();
  if (!trigger) return null;

  if (trigger.source !== "event") {
    const Icon = trigger.source === "schedule" ? Clock : Play;
    return (
      <div className="flex items-center gap-3 rounded-xl bg-muted/50 px-4 py-3 text-sm">
        <Icon aria-hidden="true" className="size-3.5 text-muted-foreground" />
        <span className="text-foreground">
          {trigger.source === "schedule" && trigger.scheduledFor
            ? t("agent:automations.runs.scheduledFor", {
                time: formatDateTime(trigger.scheduledFor),
              })
            : t("agent:automations.runs.startedManually")}
        </span>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-muted/50 px-4 py-1">
      <ul className="divide-y divide-border/60">
        {trigger.events.map((event) => (
          <AutomationRunEvent
            key={`${event.event}:${event.taskId}:${event.occurredAt}`}
            workspaceId={workspaceId}
            event={event}
          />
        ))}
      </ul>
      {trigger.moreEvents > 0 && (
        <p className="border-border/60 border-t py-2 text-muted-foreground text-xs">
          {t("agent:automations.runs.moreEvents", {
            count: trigger.moreEvents,
          })}
        </p>
      )}
    </div>
  );
}
