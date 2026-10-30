import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SettingsPageProps = {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
};

export function SettingsPage({
  title,
  description,
  actions,
  children,
  className,
}: SettingsPageProps) {
  return (
    <div
      className={cn(
        "mx-auto w-full max-w-3xl space-y-10 px-4 py-8 sm:px-8 sm:py-10",
        className,
      )}
    >
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-6">
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </header>
      {children}
    </div>
  );
}
