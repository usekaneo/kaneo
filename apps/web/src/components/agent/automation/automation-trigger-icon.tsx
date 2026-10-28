import { Clock } from "lucide-react";
import type { Automation } from "@/types/agent-automation";
import { AUTOMATION_EVENT_ICONS } from "./automation-icons";

export function AutomationTriggerIcon({
  trigger,
  className,
}: {
  trigger: Automation["trigger"];
  className?: string;
}) {
  if (trigger.type === "schedule")
    return <Clock aria-hidden="true" className={className} />;
  const Icon = AUTOMATION_EVENT_ICONS[trigger.event];
  return <Icon aria-hidden="true" className={className} />;
}
