import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

export function CheckboxMark({
  checked,
  className,
}: {
  checked: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-3.5 shrink-0 items-center justify-center rounded-[4px] border",
        checked
          ? "border-foreground bg-foreground text-background"
          : "border-muted-foreground/60",
        className,
      )}
    >
      {checked && <Check className="size-2.5" strokeWidth={3} />}
    </span>
  );
}
