import { Plus } from "lucide-react";
import type { ComponentProps } from "react";
import { cn } from "@/lib/cn";

export function SectionAddButton({
  className,
  ...props
}: ComponentProps<"button">) {
  return (
    <button
      type="button"
      className={cn(
        "flex size-6.5 shrink-0 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-accent hover:text-foreground focus-visible:bg-accent focus-visible:text-foreground disabled:pointer-events-none disabled:opacity-50 data-popup-open:bg-accent",
        className,
      )}
      {...props}
    >
      <Plus className="size-3.5" />
    </button>
  );
}
