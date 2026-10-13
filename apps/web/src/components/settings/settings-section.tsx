import type { ReactNode } from "react";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";
import { cn } from "@/lib/cn";

type SettingsSectionProps = {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
};

export function SettingsSection({
  title,
  description,
  action,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <section className={cn("space-y-3", className)}>
      {title ? (
        <SettingsSectionHeader
          title={title}
          description={description}
          action={action}
        />
      ) : null}
      {children}
    </section>
  );
}
