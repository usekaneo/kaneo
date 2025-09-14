import { ChevronDown, ChevronUp, ChevronsUp, CircleAlert } from "lucide-react";

export function getPriorityIcon(priority: string) {
  switch (priority) {
    case "urgent":
      return <CircleAlert className="h-[12px] w-[12px] text-red-400" />;
    case "high":
      return <ChevronsUp className="h-[12px] w-[12px] text-muted-foreground" />;
    case "medium":
      return <ChevronUp className="h-[12px] w-[12px] text-muted-foreground" />;
    case "low":
      return (
        <ChevronDown className="h-[12px] w-[12px] text-muted-foreground" />
      );
  }
}
