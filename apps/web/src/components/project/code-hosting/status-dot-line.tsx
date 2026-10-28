import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type StatusDotLineProps = {
  tone: "success" | "warning" | "destructive";
  children: ReactNode;
};

const dotClasses = {
  success: "bg-success",
  warning: "bg-warning",
  destructive: "bg-destructive",
};

export function StatusDotLine({ tone, children }: StatusDotLineProps) {
  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <span
        aria-hidden="true"
        className={cn("size-1.5 shrink-0 rounded-full", dotClasses[tone])}
      />
      <span className="min-w-0">{children}</span>
    </span>
  );
}
