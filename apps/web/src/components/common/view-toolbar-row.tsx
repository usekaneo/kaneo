import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/cn";

type ViewToolbarRowProps = {
  leading?: ReactNode;
  summary?: ReactNode;
  toolbar?: ReactNode;
  filterBar?: ReactNode;
  className?: string;
};

export function ViewToolbarRow({
  leading,
  summary,
  toolbar,
  filterBar,
  className,
}: ViewToolbarRowProps) {
  return (
    <TooltipProvider>
      <div
        className={cn(
          "flex h-11 shrink-0 items-center gap-2.5 border-border/80 border-b px-2 sm:px-3",
          className,
        )}
      >
        {leading}
        {summary}
        <div className="ml-auto flex shrink-0 items-center gap-1">
          {toolbar}
        </div>
      </div>
      <div className={className}>{filterBar}</div>
    </TooltipProvider>
  );
}
