import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

type OptionCardProps = {
  name: string;
  checked: boolean;
  onSelect: () => void;
  title: string;
  badge?: string;
  description: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export function OptionCard({
  name,
  checked,
  onSelect,
  title,
  badge,
  description,
  leading,
  trailing,
}: OptionCardProps) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center gap-3.5 rounded-xl border p-3.5 transition-[border-color,background-color,box-shadow] has-focus-visible:ring-2 has-focus-visible:ring-ring",
        checked
          ? "border-foreground/50 bg-accent shadow-[0_0_0_3px_--theme(--color-foreground/8%)]"
          : "border-input bg-background hover:bg-accent/50 dark:bg-input/32",
      )}
    >
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onSelect}
        className="sr-only"
      />
      {leading}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2">
          <span className="font-medium text-foreground text-sm">{title}</span>
          {badge ? (
            <span className="rounded-md bg-accent px-1.5 py-px font-medium text-[11px] text-foreground">
              {badge}
            </span>
          ) : null}
        </span>
        <span className="text-[13px] text-muted-foreground leading-[18px]">
          {description}
        </span>
      </span>
      {trailing ?? (
        <span
          aria-hidden="true"
          className={cn(
            "flex size-4 shrink-0 items-center justify-center rounded-full border",
            checked
              ? "border-foreground bg-foreground"
              : "border-foreground/20",
          )}
        >
          {checked ? (
            <span className="size-1.5 rounded-full bg-background" />
          ) : null}
        </span>
      )}
    </label>
  );
}
