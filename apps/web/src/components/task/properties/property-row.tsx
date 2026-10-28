import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type PropertyRowProps = {
  label: string;
  align?: "center" | "start";
  children: ReactNode;
};

export function PropertyRow({
  label,
  align = "center",
  children,
}: PropertyRowProps) {
  return (
    <div
      className={cn(
        "flex min-h-8 min-w-0",
        align === "start" ? "items-start" : "items-center",
      )}
    >
      <span
        className={cn(
          "w-21 shrink-0 truncate pl-2 text-muted-foreground text-xs",
          align === "start" && "flex h-8 items-center",
        )}
      >
        {label}
      </span>
      <div
        className={cn(
          "flex min-w-0 flex-1 items-center",
          align === "start" && "py-px",
        )}
      >
        {children}
      </div>
    </div>
  );
}
