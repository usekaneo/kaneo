import { InfoIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SettingsNoteProps = {
  children: ReactNode;
  icon?: LucideIcon;
  className?: string;
};

export function SettingsNote({
  children,
  icon: Icon = InfoIcon,
  className,
}: SettingsNoteProps) {
  return (
    <p
      className={cn(
        "flex items-start gap-2 px-0.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <Icon aria-hidden="true" className="mt-px size-3.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
