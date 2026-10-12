import { CheckIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type IntegrationStepProps = {
  number: number;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  done?: boolean;
  last?: boolean;
  children?: ReactNode;
};

export function IntegrationStep({
  number,
  title,
  description,
  aside,
  done = false,
  last = false,
  children,
}: IntegrationStepProps) {
  return (
    <li className="flex gap-3.5">
      <div className="flex w-8 shrink-0 flex-col items-center">
        <span
          className={cn(
            "flex size-[22px] items-center justify-center rounded-full text-[11px] font-semibold",
            done
              ? "bg-success/15 text-success-foreground"
              : "border border-foreground/30 text-foreground",
          )}
        >
          {done ? (
            <CheckIcon aria-hidden="true" className="size-3" strokeWidth={3} />
          ) : (
            number
          )}
        </span>
        {last ? null : (
          <span aria-hidden="true" className="mt-1.5 w-px flex-1 bg-border" />
        )}
      </div>
      <div className={cn("min-w-0 flex-1 space-y-3", !last && "pb-5")}>
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <p className="text-sm font-medium">{title}</p>
            {description ? (
              <p className="text-xs text-muted-foreground">{description}</p>
            ) : null}
          </div>
          {aside}
        </div>
        {children}
      </div>
    </li>
  );
}
