import { cn } from "@/lib/cn";

export function scopeLinkClass(active: boolean) {
  return cn(
    "inline-flex h-6 items-center rounded-[calc(var(--radius-lg)-3px)] px-2.5 text-[13px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
    active
      ? "bg-accent text-foreground shadow-xs/5"
      : "text-muted-foreground hover:text-foreground",
  );
}
