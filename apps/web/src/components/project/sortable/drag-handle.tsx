import { GripVertical } from "lucide-react";
import type { SortableHandleProps } from "@/components/project/sortable/use-sortable-row";
import { cn } from "@/lib/cn";

type DragHandleProps = {
  label: string;
  handleProps: SortableHandleProps;
  disabled?: boolean;
  className?: string;
};

export function DragHandle({
  label,
  handleProps,
  disabled = false,
  className,
}: DragHandleProps) {
  if (disabled) {
    return (
      <span aria-hidden="true" className={cn("w-3.5 shrink-0", className)} />
    );
  }

  return (
    <button
      type="button"
      aria-label={label}
      className={cn(
        "-mx-1 flex shrink-0 cursor-grab touch-none items-center justify-center rounded-sm px-1 py-1 text-muted-foreground/40 outline-none transition-colors hover:text-muted-foreground focus-visible:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing group-hover/row:text-muted-foreground/70",
        className,
      )}
      {...handleProps}
    >
      <GripVertical aria-hidden="true" className="size-3.5" />
    </button>
  );
}
