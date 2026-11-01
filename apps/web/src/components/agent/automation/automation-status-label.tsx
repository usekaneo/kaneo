import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { AUTOMATION_STATUS_TONES } from "./automation-status-tones";
import type { AutomationStatus } from "./get-automation-status";

export function AutomationStatusLabel({
  status,
  className,
}: {
  status: AutomationStatus;
  className?: string;
}) {
  const { t } = useTranslation();
  return (
    <span
      className={cn(
        "truncate",
        AUTOMATION_STATUS_TONES[status.tone],
        className,
      )}
    >
      {t(status.key)}
    </span>
  );
}
