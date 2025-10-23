import {
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  CircleAlert,
  Minus,
} from "lucide-react";

export function getPriorityIcon(priority: string) {
  switch (priority) {
    case "urgent":
      return <CircleAlert className="h-[12px] w-[12px] text-red-400/70" />;
    case "high":
      return <ChevronsUp className="h-[12px] w-[12px] text-orange-400/70" />;
    case "medium":
      return <ChevronUp className="h-[12px] w-[12px] text-amber-400/60" />;
    case "low":
      return <ChevronDown className="h-[12px] w-[12px] text-blue-400/60" />;
    case "no-priority":
      return <Minus className="h-[12px] w-[12px] text-muted-foreground" />;
    default:
      return <Minus className="h-[12px] w-[12px] text-muted-foreground" />;
  }
}
