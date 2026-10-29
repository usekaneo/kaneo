import { cn } from "@/lib/cn";

export function UnassignedAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-avatar-border bg-avatar-unassigned font-medium text-[9px] text-avatar-unassigned-foreground leading-none",
        className,
      )}
    >
      ?
    </span>
  );
}
