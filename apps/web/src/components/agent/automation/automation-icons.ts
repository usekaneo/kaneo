import {
  CalendarClock,
  Columns3,
  GitMerge,
  GitPullRequestArrow,
  Inbox,
  ListChecks,
  type LucideIcon,
  MessageSquare,
  Plus,
} from "lucide-react";
import type {
  AutomationEventName,
  AutomationOutput,
} from "@/types/agent-automation";

// Order shown in the event picker.
export const AUTOMATION_EVENT_ICONS: Record<AutomationEventName, LucideIcon> = {
  task_created: Plus,
  task_moved: Columns3,
  due_date_passed: CalendarClock,
  pr_opened: GitPullRequestArrow,
  pr_merged: GitMerge,
  comment_added: MessageSquare,
};

export const AUTOMATION_EVENT_NAMES = Object.keys(
  AUTOMATION_EVENT_ICONS,
) as AutomationEventName[];

export const AUTOMATION_OUTPUT_ICONS: Record<AutomationOutput, LucideIcon> = {
  proposals: ListChecks,
  digest: Inbox,
};
