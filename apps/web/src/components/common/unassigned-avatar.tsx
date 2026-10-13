import { cn } from "@/lib/cn";

export function UnassignedAvatar({ className }: { className?: string }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full border border-border bg-muted font-medium text-[9px] text-muted-foreground leading-none",
        className,
      )}
    >
      ?
    </span>
  );
}
