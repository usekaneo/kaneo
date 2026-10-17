import { Minus } from "lucide-react";
import { PriorityGlyph } from "@/components/task-chips/priority-glyph";

export function getPriorityIcon(priority: string) {
  if (!priority || priority === "no-priority") {
    return <Minus className="size-3.5 text-muted-foreground" />;
  }
  return <PriorityGlyph priority={priority} />;
}
