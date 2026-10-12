import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type SettingsIconTileProps = {
  children: ReactNode;
  className?: string;
};

export function SettingsIconTile({
  children,
  className,
}: SettingsIconTileProps) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground [&_svg]:size-4",
        className,
      )}
    >
      {children}
    </div>
  );
}
