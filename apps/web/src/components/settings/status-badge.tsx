import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export type StatusTone = "success" | "warning" | "destructive" | "neutral";

const toneClasses: Record<StatusTone, { badge: string; dot: string }> = {
  success: {
    badge: "bg-success/10 text-success-foreground",
    dot: "bg-success",
  },
  warning: {
    badge: "bg-warning/10 text-warning-foreground",
    dot: "bg-warning",
  },
  destructive: {
    badge: "bg-destructive/10 text-destructive-foreground",
    dot: "bg-destructive",
  },
  neutral: {
    badge: "bg-muted text-muted-foreground",
    dot: "bg-muted-foreground",
  },
};

type StatusBadgeProps = {
  tone: StatusTone;
  children: ReactNode;
  className?: string;
};

export function StatusBadge({ tone, children, className }: StatusBadgeProps) {
  const classes = toneClasses[tone];

  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1.5 rounded-full px-2 text-xs font-medium",
        classes.badge,
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn("size-1.5 rounded-full", classes.dot)}
      />
      {children}
    </span>
  );
}
