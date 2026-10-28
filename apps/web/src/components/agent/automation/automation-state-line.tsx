import { CircleAlert, CirclePause } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { Automation } from "@/types/agent-automation";
import { AUTOMATION_STATUS_TONES } from "./automation-status-tones";
import { getAutomationStatus } from "./get-automation-status";

// Paused, skipped, or off: shown once under the heading.
export function AutomationStateLine({
  automation,
}: {
  automation: Automation;
}) {
  const { t } = useTranslation();
  const status = getAutomationStatus(automation);
  if (!status) return null;
  const Icon = status.tone === "muted" ? CirclePause : CircleAlert;
  const skippedAt =
    status.tone === "warning" || automation.lastSkipReason === "overlap"
      ? automation.lastSkippedAt
      : null;

  return (
    <p
      role="status"
      className={cn(
        "flex flex-wrap items-center gap-2 text-sm",
        AUTOMATION_STATUS_TONES[status.tone],
      )}
    >
      <Icon aria-hidden="true" className="size-3.5 shrink-0" />
      <span>{t(status.key)}</span>
      {skippedAt && (
        <time dateTime={skippedAt} className="text-muted-foreground">
          {formatDateTime(skippedAt)}
        </time>
      )}
    </p>
  );
}
