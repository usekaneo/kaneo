import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type IntegrationPanelRowProps = {
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function IntegrationPanelRow({
  title,
  description,
  children,
  className,
}: IntegrationPanelRowProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4",
        className,
      )}
    >
      <div className="min-w-0 flex-1 space-y-0.5">
        <div className="text-sm">{title}</div>
        {description ? (
          <div className="text-xs text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
