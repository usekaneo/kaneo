import type { ReactNode } from "react";
import { SettingsIconTile } from "@/components/settings/settings-icon-tile";
import { cn } from "@/lib/cn";

type SettingsRowProps = {
  title: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  iconClassName?: string;
  badge?: ReactNode;
  children?: ReactNode;
  className?: string;
  titleClassName?: string;
  stack?: boolean;
};

export function SettingsRow({
  title,
  description,
  icon,
  iconClassName,
  badge,
  children,
  className,
  titleClassName,
  stack = false,
}: SettingsRowProps) {
  return (
    <div
      className={cn(
        "flex gap-3.5 px-4 py-3.5 sm:gap-6",
        stack ? "flex-col gap-3 sm:flex-row sm:items-center" : "items-center",
        className,
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3.5">
        {icon ? (
          <SettingsIconTile className={iconClassName}>{icon}</SettingsIconTile>
        ) : null}
        <div className="min-w-0 flex-1 space-y-0.5">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <div className={cn("truncate text-sm font-medium", titleClassName)}>
              {title}
            </div>
            {badge}
          </div>
          {description ? (
            <div className="text-xs text-muted-foreground">{description}</div>
          ) : null}
        </div>
      </div>
      {children ? (
        <div className="flex shrink-0 items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
