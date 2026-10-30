import type { ReactNode } from "react";

type SettingsEmptyProps = {
  icon: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
};

export function SettingsEmpty({
  icon,
  title,
  description,
  action,
}: SettingsEmptyProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-9 text-center">
      <div
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground [&_svg]:size-[18px]"
      >
        {icon}
      </div>
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-xs text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
