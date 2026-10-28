import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type IntegrationPanelSectionProps = {
  label?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function IntegrationPanelSection({
  label,
  description,
  action,
  children,
  className,
}: IntegrationPanelSectionProps) {
  return (
    <div className={cn("space-y-3 p-4", className)}>
      {label ? (
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-0.5">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {action}
        </div>
      ) : null}
      {children}
    </div>
  );
}
