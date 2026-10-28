import {
  ChevronDown,
  ChevronsUp,
  ChevronUp,
  CircleAlert,
  type LucideIcon,
  Minus,
} from "lucide-react";
import { cn } from "@/lib/cn";

// The chevron icons Kaneo used before the 2.47 mark glyphs, kept for people
// who prefer them.
const ICONS: Record<string, { Icon: LucideIcon; tone: string }> = {
  low: { Icon: ChevronDown, tone: "text-info-foreground/85" },
  medium: { Icon: ChevronUp, tone: "text-warning-foreground/80" },
  high: { Icon: ChevronsUp, tone: "text-warning-foreground" },
  urgent: { Icon: CircleAlert, tone: "text-destructive-foreground" },
};

const NO_PRIORITY = { Icon: Minus, tone: "text-muted-foreground" };

type ClassicPriorityIconProps = {
  priority: string | null | undefined;
  className?: string;
};

export function ClassicPriorityIcon({
  priority,
  className,
}: ClassicPriorityIconProps) {
  const { Icon, tone } = ICONS[priority ?? ""] ?? NO_PRIORITY;

  return (
    <Icon
      aria-hidden="true"
      className={cn("size-3.5 shrink-0", tone, className)}
    />
  );
}
