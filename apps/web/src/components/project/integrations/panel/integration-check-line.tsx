import { AlertTriangleIcon, CheckCircle2Icon, XCircleIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type IntegrationCheckLineProps = {
  tone: "success" | "warning" | "destructive";
  children: ReactNode;
  action?: ReactNode;
};

const icons = {
  success: CheckCircle2Icon,
  warning: AlertTriangleIcon,
  destructive: XCircleIcon,
};

const iconClasses = {
  success: "text-success-foreground",
  warning: "text-warning-foreground",
  destructive: "text-destructive-foreground",
};

export function IntegrationCheckLine({
  tone,
  children,
  action,
}: IntegrationCheckLineProps) {
  const Icon = icons[tone];

  return (
    <div role="status" className="flex items-start gap-2">
      <Icon
        aria-hidden="true"
        className={cn("mt-px size-3.5 shrink-0", iconClasses[tone])}
      />
      <div className="min-w-0 flex-1 text-xs text-muted-foreground">
        {children}
      </div>
      {action}
    </div>
  );
}
