import type { ReactNode } from "react";

type SettingsSectionHeaderProps = {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function SettingsSectionHeader({
  title,
  description,
  action,
}: SettingsSectionHeaderProps) {
  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
      <div className="space-y-0.5">
        <h2 className="text-sm font-medium">{title}</h2>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
